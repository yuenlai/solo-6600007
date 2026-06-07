import React, { useState, useEffect } from 'react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  targetSelector?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const ONBOARDING_KEY = 'audioid_onboarding_completed';

const steps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: '👋 欢迎使用 AudioID',
    description: '这是一款强大的音频指纹识别工具，帮您快速识别歌曲、管理音乐库。让我们花一分钟了解核心功能吧！',
    icon: '🎵',
  },
  {
    id: 'recognize',
    title: '🎤 录音识别',
    description: '点击左侧「识别」标签，录制或上传一段音频，系统会自动识别出对应的歌曲信息。支持实时录音和文件上传两种方式。',
    icon: '🎤',
    targetSelector: '[data-onboarding="recognize"]',
    position: 'right',
  },
  {
    id: 'library',
    title: '📚 上传入库',
    description: '点击左侧「指纹库」标签，您可以上传歌曲文件，系统会自动生成音频指纹并保存到数据库中，方便后续识别匹配。',
    icon: '📚',
    targetSelector: '[data-onboarding="library"]',
    position: 'right',
  },
  {
    id: 'history',
    title: '📋 结果回看',
    description: '点击左侧「历史」标签，可以查看所有识别记录，包括识别成功和失败的结果。点击歌曲名称还可以查看详细信息。',
    icon: '📋',
    targetSelector: '[data-onboarding="history"]',
    position: 'right',
  },
  {
    id: 'complete',
    title: '🎉 准备就绪！',
    description: '您已经了解了 AudioID 的核心功能。现在就开始使用吧！如果需要重新查看引导，可以在设置中找到。',
    icon: '🚀',
  },
];

interface OnboardingGuideProps {
  onComplete?: () => void;
}

export const OnboardingGuide: React.FC<OnboardingGuideProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const completed = localStorage.getItem(ONBOARDING_KEY);
    if (!completed) {
      setTimeout(() => setIsVisible(true), 500);
    }
  }, []);

  useEffect(() => {
    if (isVisible && steps[currentStep].targetSelector) {
      const target = document.querySelector(steps[currentStep].targetSelector!);
      if (target) {
        setTargetRect(target.getBoundingClientRect());
      }
    } else {
      setTargetRect(null);
    }
  }, [currentStep, isVisible]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setIsVisible(false);
    onComplete?.();
  };

  if (!isVisible) return null;

  const step = steps[currentStep];
  const showHighlight = targetRect !== null;

  const getTooltipPosition = () => {
    if (!targetRect) return {};
    
    const tooltipWidth = 320;
    const tooltipHeight = 240;
    const padding = 20;
    
    let top = 0;
    let left = 0;
    
    switch (step.position) {
      case 'right':
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
        left = targetRect.right + padding;
        break;
      case 'left':
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
        left = targetRect.left - tooltipWidth - padding;
        break;
      case 'bottom':
        top = targetRect.bottom + padding;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        break;
      case 'top':
        top = targetRect.top - tooltipHeight - padding;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        break;
      default:
        break;
    }
    
    top = Math.max(20, Math.min(top, window.innerHeight - tooltipHeight - 20));
    left = Math.max(20, Math.min(left, window.innerWidth - tooltipWidth - 20));
    
    return { top, left };
  };

  const tooltipStyle = showHighlight ? getTooltipPosition() : {};

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          pointerEvents: 'auto',
          transition: 'all 0.3s ease',
        }}
      />
      
      {showHighlight && targetRect && (
        <div
          style={{
            position: 'absolute',
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            border: '3px solid #4fc3f7',
            borderRadius: '8px',
            boxShadow: '0 0 20px rgba(79, 195, 247, 0.6), inset 0 0 20px rgba(79, 195, 247, 0.2)',
            pointerEvents: 'none',
            animation: 'pulse 2s infinite',
          }}
        />
      )}
      
      <div
        style={{
          position: showHighlight ? 'absolute' : 'fixed',
          ...(showHighlight ? tooltipStyle : {
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }),
          width: '320px',
          background: '#fff',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
          pointerEvents: 'auto',
          animation: 'fadeIn 0.3s ease',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>{step.icon}</div>
          <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: '#333' }}>
            {step.title}
          </h3>
          <p style={{ margin: 0, fontSize: '14px', color: '#666', lineHeight: 1.6 }}>
            {step.description}
          </p>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '20px' }}>
          {steps.map((_, index) => (
            <div
              key={index}
              style={{
                width: index === currentStep ? '24px' : '8px',
                height: '8px',
                borderRadius: '4px',
                background: index === currentStep ? '#2196f3' : '#e0e0e0',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={handleSkip}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'transparent',
              color: '#999',
              fontSize: '13px',
              cursor: 'pointer',
              borderRadius: '6px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            跳过引导
          </button>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                style={{
                  padding: '8px 20px',
                  border: '1px solid #e0e0e0',
                  background: '#fff',
                  color: '#333',
                  fontSize: '14px',
                  cursor: 'pointer',
                  borderRadius: '8px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#2196f3')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e0e0e0')}
              >
                上一步
              </button>
            )}
            <button
              onClick={handleNext}
              style={{
                padding: '8px 24px',
                border: 'none',
                background: 'linear-gradient(135deg, #2196f3, #1976d2)',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                borderRadius: '8px',
                transition: 'all 0.2s',
                boxShadow: '0 2px 8px rgba(33, 150, 243, 0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(33, 150, 243, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(33, 150, 243, 0.3)';
              }}
            >
              {currentStep === steps.length - 1 ? '开始使用' : '下一步'}
            </button>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
};

export const resetOnboarding = () => {
  localStorage.removeItem(ONBOARDING_KEY);
};

export const isOnboardingCompleted = () => {
  return localStorage.getItem(ONBOARDING_KEY) === 'true';
};
