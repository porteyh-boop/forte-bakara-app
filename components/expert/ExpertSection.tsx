interface ExpertSectionProps {
  title: string;
  children: React.ReactNode;
}

export default function ExpertSection({ title, children }: ExpertSectionProps) {
  return (
    <section className="mb-5">
      <h2 className="text-sm font-bold text-navy mb-3 flex items-center gap-2">
        <span className="w-1 h-4 bg-gold rounded-full" />
        {title}
      </h2>
      {children}
    </section>
  );
}
