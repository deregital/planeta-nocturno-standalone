import InstanceLogo from '@/components/header/InstanceLogo';
import Navbar from '@/components/header/Navbar';

function TopBar() {
  return (
    <div className='bg-pn-background w-full lg:h-[16vh] md:h-[12vh] h-[8vh] flex items-center pl-[20px] md:pl-[50px]'>
      <InstanceLogo size='lg' />
      <Navbar />
    </div>
  );
}

export default TopBar;
