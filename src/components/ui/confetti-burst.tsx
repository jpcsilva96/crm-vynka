const PARTICLES = [
  { x: "-82px", y: "-102px", rotate: "-145deg", left: "42%", color: "#22c55e", delay: "0ms" },
  { x: "-44px", y: "-118px", rotate: "-110deg", left: "46%", color: "#06b6d4", delay: "35ms" },
  { x: "-10px", y: "-130px", rotate: "-70deg", left: "49%", color: "#f59e0b", delay: "20ms" },
  { x: "18px", y: "-126px", rotate: "65deg", left: "52%", color: "#f43f5e", delay: "45ms" },
  { x: "56px", y: "-110px", rotate: "105deg", left: "56%", color: "#8b5cf6", delay: "10ms" },
  { x: "92px", y: "-96px", rotate: "140deg", left: "60%", color: "#10b981", delay: "55ms" },
  { x: "-70px", y: "-74px", rotate: "-95deg", left: "44%", color: "#f97316", delay: "30ms" },
  { x: "68px", y: "-78px", rotate: "90deg", left: "58%", color: "#14b8a6", delay: "60ms" },
];

export function ConfettiBurst() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[90] overflow-hidden motion-reduce:hidden" aria-hidden="true">
      {PARTICLES.map((particle, index) => (
        <span
          key={`${particle.left}-${index}`}
          className="animate-confetti-burst absolute top-[18%] h-2.5 w-1.5 rounded-full opacity-0"
          style={
            {
              left: particle.left,
              backgroundColor: particle.color,
              animationDelay: particle.delay,
              ["--confetti-x" as string]: particle.x,
              ["--confetti-y" as string]: particle.y,
              ["--confetti-rotate" as string]: particle.rotate,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
