import Image from "next/image";

export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <Image alt="" height={48} priority src="/rfl-logo.png" width={48} />
    </span>
  );
}
