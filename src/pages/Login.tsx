import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VynkaLogo } from "@/components/VynkaLogo";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  onLogin: (email: string) => void;
}

export default function Login({ onLogin }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  
  // Stages: 'email' -> 'password' -> 'reset' -> done
  const [stage, setStage] = useState<'email' | 'password' | 'reset'>('email');
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null);

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (stage === 'email') {
      const trimmed = email.trim().toLowerCase();
      if (!trimmed || !trimmed.includes("@")) {
        setError("Informe um email válido");
        return;
      }
      setStage('password');
      return;
    }

    if (stage === 'password') {
      try {
        const normalizedEmail = email.trim().toLowerCase();
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password
        });
        
        if (authError) {
          setError("Credenciais incorretas");
          return;
        }

        // Se conectou com sucesso, busca o perfil para ver se precisa resetar senha
        const { data: profile } = await supabase
          .from("profiles")
          .select("require_password_change, id")
          .eq("id", data.user.id)
          .single();

        if (profile?.require_password_change) {
          setCurrentUser({ id: data.user.id, email: normalizedEmail });
          setStage('reset');
        } else {
          onLogin(normalizedEmail);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Erro ao conectar");
      }
      return;
    }

    if (stage === 'reset') {
      if (newPassword.length < 6) {
        setError("A nova senha deve ter no mínimo 6 caracteres.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("As senhas não coincidem.");
        return;
      }

      try {
        const { error: resetError } = await supabase.auth.updateUser({ password: newPassword });
        if (resetError) throw resetError;

        if (!currentUser) throw new Error("Usuário não encontrado.");

        const { data: updateResult, error: profileError } = await supabase.functions.invoke("update-user", {
          body: {
            id: currentUser.id,
            updates: { requirePasswordChange: false },
          },
        });
        if (profileError) throw profileError;
        if (updateResult?.error) throw new Error(updateResult.error);
        
        onLogin(currentUser.email);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Erro ao atualizar senha");
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-md space-y-8">
        <div className="flex w-full flex-col items-center justify-center text-center">
          <div className="flex w-full justify-center">
            <VynkaLogo className="text-[28px]" />
          </div>
        </div>

        <form onSubmit={handleNext} className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
          {stage === 'email' && (
            <div className="space-y-2 animate-in fade-in zoom-in-95 duration-300">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                autoFocus
              />
            </div>
          )}

          {stage === 'password' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-right-4 duration-300">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Sua senha..."
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                autoFocus
              />
            </div>
          )}

          {stage === 'reset' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="rounded-md bg-primary/10 p-3 text-sm text-primary mb-4">
                <strong>Primeiro acesso detectado.</strong> Por favor, defina uma nova senha de segurança.
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova Senha</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setError("");
                  }}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError("");
                  }}
                />
              </div>
            </div>
          )}

          {error && <p className="text-xs text-destructive font-medium">{error}</p>}

          <div className="pt-2">
            <Button type="submit" className="w-full">
              {stage === 'email' ? 'Continuar' : stage === 'password' ? 'Entrar' : 'Salvar e Entrar'}
            </Button>
            {stage !== 'email' && (
              <Button type="button" variant="ghost" className="w-full mt-2" onClick={() => {
                setStage('email');
                setPassword('');
                setError('');
              }}>
                Voltar
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
