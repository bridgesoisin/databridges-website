interface LinkedInPostCardProps {
  previewText: string;
  postUrl: string;
}

export default function LinkedInPostCard({
  previewText,
  postUrl,
}: LinkedInPostCardProps) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      {/* Author header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="font-syne w-8 h-8 rounded-full bg-navy flex items-center justify-center text-cyan text-xs font-bold">
          db
        </div>
        <div>
          <p className="text-sm font-medium text-navy">
            Ois&iacute;n Bridges
          </p>
          <p className="text-xs text-gray-400">
            DataBridges
          </p>
        </div>
      </div>

      {/* Post text with fade */}
      <div className="text-fade h-24">
        <p className="text-sm text-gray-700 leading-relaxed">
          {previewText}
        </p>
      </div>

      {/* Footer link */}
      <a
        href={postUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block text-cyan text-sm font-medium mt-4 hover:underline transition-colors duration-200"
      >
        Read on LinkedIn &rarr;
      </a>
    </div>
  );
}
