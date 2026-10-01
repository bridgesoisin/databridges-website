import Link from "next/link";

interface ServiceCardProps {
  icon: React.ReactNode;
  name: string;
  description: string;
  href: string;
  ctaLabel?: string;
  compact?: boolean;
}

export default function ServiceCard({
  icon,
  name,
  description,
  href,
  ctaLabel = "Learn more",
  compact = false,
}: ServiceCardProps) {
  return (
    <div className={`bg-white border border-gray-100 rounded-2xl ${compact ? "p-6" : "p-8"} transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-cyan motion-reduce:transition-none motion-reduce:hover:translate-y-0`}>
      <div className={`${compact ? "w-10 h-10" : "w-12 h-12"} rounded-xl bg-cyan/10 flex items-center justify-center text-cyan`}>
        {icon}
      </div>
      <h3 className="font-syne text-xl text-navy mt-4 font-semibold">
        {name}
      </h3>
      <p className="text-gray-600 mt-2">
        {description}
      </p>
      <Link
        href={href}
        className={`inline-block text-cyan-ink text-sm font-medium ${compact ? "mt-4" : "mt-6"} hover:underline transition-colors duration-200`}
      >
        {ctaLabel} &rarr;
      </Link>
    </div>
  );
}
