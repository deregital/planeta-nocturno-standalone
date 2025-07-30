import MiExpo_Logo from './MiExpo_Logo';
import Navbar from './Navbar';

function TopBar() {
  return (
    <div className='bg-pn-background  w-full lg:h-[16vh] md:h-[12vh] h-[8vh] flex items-center pl-[20px] md:pl-[50px]'>
      <MiExpo_Logo />
      <Navbar />
    </div>
  );
}

export default TopBar;
