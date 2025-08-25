import TopBar from '@/components/header/TopBar';

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className='grid grid-rows-[auto_1fr] h-screen'>
      <TopBar />
      {children}
    </div>
  );
}
