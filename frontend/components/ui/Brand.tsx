import { brand } from "../../shared/brand";
export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <img
      src={brand.icon}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
    />
  );
}
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="platform-brand">
      <BrandMark />
      {!compact && (
        <span>
          <strong>{brand.name}</strong>
          <small>{brand.tagline}</small>
        </span>
      )}
    </span>
  );
}
