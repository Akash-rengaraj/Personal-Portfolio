import React, { useEffect } from 'react';

function StatsWidget() {
  useEffect(() => {
    const updateEyePosition = (e) => {
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
      if (clientX === undefined) return;

      document.querySelectorAll('.eye').forEach(eye => {
        const rect = eye.getBoundingClientRect();
        const eyeCenterX = rect.left + rect.width / 2;
        const eyeCenterY = rect.top + rect.height / 2;

        const angle = Math.atan2(clientY - eyeCenterY, clientX - eyeCenterX);
        const maxDistance = 4;
        const pupil = eye.querySelector('.pupil');
        const x = Math.cos(angle) * maxDistance;
        const y = Math.sin(angle) * maxDistance;

        pupil.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
      });
    };
    
    const resetPupils = () => {
        document.querySelectorAll('.pupil').forEach(pupil => {
            pupil.style.transform = 'translate(-50%, -50%)';
        });
    };

    window.addEventListener('mousemove', updateEyePosition);
    window.addEventListener('touchmove', updateEyePosition);
    window.addEventListener('mouseleave', resetPupils);
    window.addEventListener('touchend', resetPupils);

    return () => {
      window.removeEventListener('mousemove', updateEyePosition);
      window.removeEventListener('touchmove', updateEyePosition);
      window.removeEventListener('mouseleave', resetPupils);
      window.removeEventListener('touchend', resetPupils);
    };
  }, []);

  return (
    <div className="stats">
      <div className="face-container">
        <div className="eyes">
          <div className="eye"><div className="pupil"></div></div>
          <div className="eye"><div className="pupil"></div></div>
        </div>
        <div className="smile"></div>
      </div>
      <div className="stats-message">Welcome Devs!</div>
    </div>
  );
}

export default StatsWidget;