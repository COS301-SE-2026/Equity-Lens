import { MotionConfig } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';

import useGuestStart from '../../components/auth/GuestStart/useGuestStart';

import FinalCta from './sections/FinalCta';
import Footer from './sections/Footer';
import Hero from './sections/Hero';
import HowItWorks from './sections/HowItWorks';
import Nav from './sections/Nav';
import PlatformGallery from './sections/PlatformGallery';
import Security from './sections/Security';

const DESCRIPTION =
  'EquityLens flags the unusual days in your portfolio, splits each move into a market part and a company part, and lines up the news published around it. Try it without signing up.';

const Landing = () => {
  // this page is designed dark only, the visitor's own theme comes back when they leave
  useEffect(() => {
    const root = document.documentElement;
    const previousTheme = root.getAttribute('data-theme');
    const previousDarkClass = root.classList.contains('dark');

    root.setAttribute('data-theme', 'dark');
    root.classList.add('dark');

    return () => {
      if (previousTheme === null) {
        root.removeAttribute('data-theme');
      } else {
        root.setAttribute('data-theme', previousTheme);
      }

      root.classList.toggle('dark', previousDarkClass);
    };
  }, []);

  const [guestError, setGuestError] = useState(/** @type {string | null} */ (null));
  const [pressedAt, setPressedAt] = useState('hero');
  const guest = useGuestStart(setGuestError);

  /** @param {string} place */
  const ctaFor = (place) => ({
    guest,
    error: pressedAt === place ? guestError : null,
    onTry: () => {
      setPressedAt(place);
      guest.start();
    },
  });

  return (
    <>
      <Helmet>
        <title>EquityLens · See why your portfolio moved</title>
        <meta name="description" content={DESCRIPTION} />
        <meta property="og:title" content="EquityLens · See why your portfolio moved" />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta name="theme-color" content="#000000" />
        <meta name="color-scheme" content="dark" />
      </Helmet>

      <MotionConfig reducedMotion="user">
        <div className="min-h-[100dvh] overflow-x-clip bg-[var(--surface-base)] text-[var(--text-primary)]">
          <Nav />
          <main id="main">
            <Hero cta={ctaFor('hero')} />
            <PlatformGallery cta={ctaFor('gallery')} />
            <HowItWorks />
            <Security />
            <FinalCta cta={ctaFor('final')} />
          </main>
          <Footer />
        </div>
      </MotionConfig>
    </>
  );
};

export default Landing;
