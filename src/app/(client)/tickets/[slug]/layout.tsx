import ScrollToTop from '@/components/common/ScrollToTop';

export default function TicketsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ScrollToTop />
      {children}
    </>
  );
}
