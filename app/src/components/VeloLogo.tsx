export default function VeloLogo({ size = 28, className = "" }: { size?: number, className?: string }) {
  return (
    <img 
      src="/Velo.png" 
      alt="Velo Logo" 
      height={size} 
      style={{ height: size, width: "auto", objectFit: "contain", flexShrink: 0 }} 
      className={className} 
    />
  );
}
