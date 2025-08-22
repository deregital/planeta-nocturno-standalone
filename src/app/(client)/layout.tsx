import TopBar from '@/components/header/TopBar';

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div>
      <TopBar />
      {children}
    </div>
  );
}
