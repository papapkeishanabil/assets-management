export default function BrandLogo({ className = '' }) {
  return (
    <div className={`relative inline-block shrink-0 ${className}`}>
      <img
        src="/assets/harmas-logo.png"
        alt="Harmas Uniform"
        className="block h-full w-full object-contain"
      />
    </div>
  );
}
