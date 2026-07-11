import { useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandingPanel from '../components/login/BrandingPanel';
import LoginForm from '../components/login/LoginForm';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const { user, loading } = useAuth();
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    let bgStars = [];

    function resize() {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      // Regenerate background stars on resize
      bgStars = Array.from({ length: 200 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: 0.3 + Math.random() * 1.5,
        alpha: 0.1 + Math.random() * 0.35,
        speed: 0.2 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
      }));
    }
    resize();
    window.addEventListener('resize', resize);

    // Shooting stars — cross entire background
    const MAX = 6;
    const shooters = [];

    function spawn() {
      const w = canvas.width;
      const h = canvas.height;
      // Spawn from random edge so they cross the full screen
      const edge = Math.floor(Math.random() * 3); // 0: top, 1: left, 2: top-right
      let x, y, angle;
      if (edge === 0) {
        x = Math.random() * w;
        y = -10;
        angle = Math.PI / 4 + Math.random() * Math.PI / 3;
      } else if (edge === 1) {
        x = -10;
        y = Math.random() * h * 0.6;
        angle = Math.PI / 6 + Math.random() * Math.PI / 4;
      } else {
        x = w * 0.6 + Math.random() * w * 0.4;
        y = -10;
        angle = Math.PI * 0.4 + Math.random() * Math.PI * 0.3;
      }

      const speed = 4 + Math.random() * 5;

      return {
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        tail: 80 + Math.random() * 120,
        headSize: 1.5 + Math.random() * 1.5,
        life: 0,
        maxLife: 100 + Math.random() * 60,
        alpha: 0.4 + Math.random() * 0.6,
      };
    }

    let spawnTimer = 0;

    function draw() {
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      // Faint background stars
      for (const s of bgStars) {
        const twinkle = Math.sin(Date.now() * 0.001 * s.speed + s.phase) * 0.35 + 0.65;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${s.alpha * twinkle})`;
        ctx.fill();
      }

      // Spawn
      spawnTimer++;
      if (spawnTimer > 20 && shooters.length < MAX) {
        spawnTimer = 0;
        shooters.push(spawn());
      }

      // Draw
      for (let i = shooters.length - 1; i >= 0; i--) {
        const s = shooters[i];
        s.x += s.vx;
        s.y += s.vy;
        s.life++;

        if (s.life > s.maxLife || s.x > w + 200 || s.x < -200 || s.y > h + 200) {
          shooters.splice(i, 1);
          continue;
        }

        const progress = s.life / s.maxLife;
        const alpha = s.alpha * (1 - progress * 0.6) * Math.min(s.life / 8, 1);

        ctx.save();
        ctx.globalAlpha = alpha;

        // Tail
        const tailLen = s.tail / Math.hypot(s.vx, s.vy);
        const tx = s.x - s.vx * tailLen;
        const ty = s.y - s.vy * tailLen;

        const grad = ctx.createLinearGradient(s.x, s.y, tx, ty);
        grad.addColorStop(0, 'rgba(200,230,255,0.9)');
        grad.addColorStop(0.3, 'rgba(160,210,255,0.4)');
        grad.addColorStop(1, 'transparent');

        ctx.strokeStyle = grad;
        ctx.lineWidth = s.headSize * 0.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();

        // Head glow
        for (let g = 3; g >= 1; g--) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.headSize * g * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(220,240,255,${0.1 / g})`;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.headSize * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();

        ctx.restore();
      }

      animId = requestAnimationFrame(draw);
    }
    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  if (user) return <Navigate to="/" replace />;
  if (loading) return <div className={styles.page}><div className={styles.brandSide}><canvas ref={canvasRef} className={styles.canvas} /></div></div>;

  return (
    <div className={styles.page}>
      <div className={styles.brandSide}>
        <canvas ref={canvasRef} className={styles.canvas} />
        <div className={styles.grid} />
        <div className={styles.glow} />
        <BrandingPanel />
      </div>
      <div className={styles.formSide}>
        <LoginForm />
      </div>
    </div>
  );
}
