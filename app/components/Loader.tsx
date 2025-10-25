import Image from 'next/image';

const Loader = () => {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-transparent backdrop-blur-sm px-4">
      <div className="relative flex items-center justify-center">
        <div className="w-24 h-24 md:w-32 md:h-32 border-4 border-gray-300 border-t-transparent rounded-full animate-spin"></div>

        <Image
          src="https://exthalpy-public-bucket.blr1.cdn.digitaloceanspaces.com/ChatGPT%20Image%20Oct%2022,%202025,%2002_16_41%20PM.png"
          alt="Salesman.sh Logo"
          className="absolute object-contain w-12 h-12 md:w-16 md:h-16"
          width={64}
          height={64}
          quality={100}
          priority
          unoptimized
        />
      </div>
    </div>
  );
};

export default Loader;
