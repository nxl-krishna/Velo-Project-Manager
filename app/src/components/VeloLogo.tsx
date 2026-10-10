const ASSETS = {
  wordmark: { src: "/velo-logo.png", ratio: 1328 / 463 },
  light: { src: "/velo-logo-light.png", ratio: 1328 / 463 },
  mark: { src: "/velo-mark.png", ratio: 595 / 455 },
} as const;

export default function VeloLogo({
  size = 24,
  variant = "wordmark",
  className = "",
}: {
  size?: number;
  variant?: keyof typeof ASSETS;
  className?: string;
}) {
  const { src, ratio } = ASSETS[variant];
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Velo"
      width={Math.round(size * ratio)}
      height={size}
      style={{ height: size, width: "auto", objectFit: "contain", flexShrink: 0 }}
      className={className}
    />
  );
}
