import InstanceLogo from './InstanceLogo';
import Navbar from './Navbar';

function TopBar() {
  const [firstWord, ...rest] = process.env.NEXT_PUBLIC_INSTANCE_NAME!.split(' ');

  return (
    <div className='bg-pn-background  w-full lg:h-[16vh] md:h-[12vh] h-[8vh] flex items-center pl-[20px] md:pl-[50px]'>
      <InstanceLogo
        firstWord={firstWord}
        rest={rest.join(' ')}
      />
      <Navbar />
    </div>
  );
}

export default TopBar;
