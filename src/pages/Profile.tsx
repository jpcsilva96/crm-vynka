import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { Camera, KeyRound, Save, Trash2, UserCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useUsersStore } from "@/lib/usersStore";
import { UserAvatar } from "@/components/pipeline/UserAvatar";

interface Props {
  userEmail: string;
  onUserEmailChange: (email: string) => void;
}

export default function Profile({ userEmail, onUserEmailChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { users, updateUser, fetchUsers } = useUsersStore();
  const currentUser = users.find((user) => user.email === userEmail);

  const [name, setName] = useState("");
  const [email, setEmail] = useState(userEmail);
  const [avatar, setAvatar] = useState<string | undefined>(undefined);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    setName(currentUser.name || "");
    setEmail(currentUser.email || userEmail);
    setAvatar(currentUser.avatar || undefined);
  }, [currentUser, userEmail]);

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setAvatar(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    if (!currentUser) {
      toast.error("Perfil do usuário não encontrado.");
      return;
    }

    if (!name.trim()) {
      toast.error("Informe seu nome.");
      return;
    }

    if (!email.trim()) {
      toast.error("Informe seu email.");
      return;
    }

    setIsSavingProfile(true);
    try {
      await updateUser(currentUser.id, {
        name: name.trim(),
        avatar: avatar || undefined,
      });

      const nextEmail = email.trim().toLowerCase();
      if (nextEmail !== currentUser.email) {
        const { data, error } = await supabase.auth.updateUser({ email: nextEmail });
        if (error) throw error;

        const authEmail = data.user?.email?.toLowerCase();
        if (authEmail === nextEmail) {
          await updateUser(currentUser.id, { email: nextEmail });
          localStorage.setItem("vynka_user_email", nextEmail);
          onUserEmailChange(nextEmail);
          toast.success("Email atualizado com sucesso.");
        } else {
          toast.success("Pedido de alteracao de email enviado. Confirme o novo email para concluir.");
        }
      } else {
        toast.success("Perfil atualizado com sucesso.");
      }

      await fetchUsers();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Erro ao salvar perfil.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error("Preencha os dois campos de senha.");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("A nova senha deve ter no minimo 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setIsSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      if (currentUser) {
        await updateUser(currentUser.id, { requirePasswordChange: false });
      }

      setNewPassword("");
      setConfirmPassword("");
      toast.success("Senha atualizada com sucesso.");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar senha.");
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Perfil</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Atualize seus dados pessoais, logo do perfil e senha de acesso.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCircle2 className="h-5 w-5" />
                Dados do Perfil
              </CardTitle>
              <CardDescription>Defina como seu usuário aparece no sistema.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <UserAvatar name={name || currentUser?.name || "U"} avatar={avatar} size="lg" className="h-20 w-20 text-xl" />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
                    <Camera className="h-4 w-4" />
                    Alterar logo
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setAvatar(undefined)} className="gap-2 text-muted-foreground">
                    <Trash2 className="h-4 w-4" />
                    Remover
                  </Button>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="profile-name">Nome</Label>
                  <Input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profile-email">Email</Label>
                  <Input
                    id="profile-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="seu@email.com"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} disabled={isSavingProfile} className="gap-2">
                  <Save className="h-4 w-4" />
                  {isSavingProfile ? "Salvando..." : "Salvar perfil"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Seguranca
              </CardTitle>
              <CardDescription>Altere sua senha sempre que precisar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova senha</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Minimo de 6 caracteres"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repita a nova senha"
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleChangePassword} disabled={isSavingPassword} className="gap-2">
                  <KeyRound className="h-4 w-4" />
                  {isSavingPassword ? "Atualizando..." : "Atualizar senha"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
