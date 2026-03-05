import Link from "next/link";

interface ServiceCardProps {
  icon: React.ReactNode;
  name: string;
  description: string;
  href: string;
}

export default function ServiceCard({
  icon,
  name,
  description,
  href,
}: ServiceCardProps) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-cyan">
      <div className="w-12 h-12 rounded-xl bg-cyan/10 flex items-center justify-center text-cyan">
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
        className="inline-block text-cyan text-sm font-medium mt-6 hover:underline transition-colors duration-200"
      >
        Learn more &rarr;
      </Link>
    </div>
  );
}
