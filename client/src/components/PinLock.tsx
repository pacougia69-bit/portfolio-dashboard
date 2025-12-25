/**
 * PIN-Lock Komponente
 * Zeigt PIN-Eingabe beim App-Start wenn aktiviert
 */

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Lock, Delete, Eye, EyeOff } from 'lucide-react';

interface PinLockProps {
  onUnlock: () => void;
  onCancel?: () => void;
  title?: string;
  subtitle?: string;
  pinLength?: number;
  verifyPin: (pin: string) => Promise<boolean>;
}

export default function PinLock({ 
  onUnlock, 
  onCancel,
  title = "PIN eingeben",
  subtitle = "Geben Sie Ihren PIN ein um fortzufahren",
  pinLength = 4,
  verifyPin
}: PinLockProps) {
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const handleNumberClick = (num: string) => {
    if (pin.length < pinLength) {
      const newPin = pin + num;
      setPin(newPin);
      setError('');
      
      // Auto-verify when PIN is complete
      if (newPin.length === pinLength) {
        verifyPinCode(newPin);
      }
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  const verifyPinCode = async (pinToVerify: string) => {
    setIsVerifying(true);
    try {
      const isValid = await verifyPin(pinToVerify);
      if (isValid) {
        onUnlock();
      } else {
        setAttempts(prev => prev + 1);
        setError('Falscher PIN');
        setPin('');
        
        // Vibrate on mobile if available
        if (navigator.vibrate) {
          navigator.vibrate(200);
        }
      }
    } catch (err) {
      setError('Fehler bei der Überprüfung');
      setPin('');
    } finally {
      setIsVerifying(false);
    }
  };

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleNumberClick(e.key);
      } else if (e.key === 'Backspace') {
        handleDelete();
      } else if (e.key === 'Escape' && onCancel) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, onCancel]);

  return (
    <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center">
      <div className="w-full max-w-sm mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>

        {/* PIN Display */}
        <div className="flex justify-center gap-3">
          {Array.from({ length: pinLength }).map((_, i) => (
            <div
              key={i}
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-mono transition-all ${
                i < pin.length
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-muted/30'
              } ${error && i < pin.length ? 'border-red-500 animate-shake' : ''}`}
            >
              {i < pin.length ? (
                showPin ? pin[i] : '•'
              ) : null}
            </div>
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <p className="text-center text-sm text-red-500 animate-pulse">
            {error} {attempts >= 3 && `(${attempts} Versuche)`}
          </p>
        )}

        {/* Show/Hide PIN Toggle */}
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPin(!showPin)}
            className="text-muted-foreground"
          >
            {showPin ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
            {showPin ? 'PIN verbergen' : 'PIN anzeigen'}
          </Button>
        </div>

        {/* Number Pad */}
        <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleNumberClick(num.toString())}
              disabled={isVerifying}
              className="h-14 sm:h-16 rounded-xl bg-muted/50 hover:bg-muted active:bg-muted/80 text-xl font-semibold transition-all active:scale-95 disabled:opacity-50"
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleClear}
            disabled={isVerifying || pin.length === 0}
            className="h-14 sm:h-16 rounded-xl bg-muted/30 hover:bg-muted/50 text-sm font-medium transition-all active:scale-95 disabled:opacity-50"
          >
            Löschen
          </button>
          <button
            onClick={() => handleNumberClick('0')}
            disabled={isVerifying}
            className="h-14 sm:h-16 rounded-xl bg-muted/50 hover:bg-muted active:bg-muted/80 text-xl font-semibold transition-all active:scale-95 disabled:opacity-50"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            disabled={isVerifying || pin.length === 0}
            className="h-14 sm:h-16 rounded-xl bg-muted/30 hover:bg-muted/50 flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Loading indicator */}
        {isVerifying && (
          <div className="flex justify-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Cancel Button (optional) */}
        {onCancel && (
          <div className="text-center pt-4">
            <Button variant="ghost" onClick={onCancel} className="text-muted-foreground">
              Abbrechen
            </Button>
          </div>
        )}
      </div>

      {/* CSS for shake animation */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
}
