import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/CoursesPage.css';
import SchoolIcon from '@mui/icons-material/School';
import electronicsQuizBank from '../assets/quiz/electronics_quiz_bank.json';
import electronicsActivityBank from '../assets/activities/electronics_activity_bank.json';
import iotActivityBank from '../assets/activities/iot_activity_bank.json';
import aiActivityBank from '../assets/activities/ai_activity_bank.json';
import printingActivityBank from '../assets/activities/3d_printing_activity_bank.json';
import droneActivityBank from '../assets/activities/drone_activity_bank.json';
import roboticsActivityBank from '../assets/activities/robotics_activity_bank.json';
import arActivityBank from '../assets/activities/ar_activity_bank.json';
import mrActivityBank from '../assets/activities/mr_activity_bank.json';
import vrActivityBank from '../assets/activities/vr_activity_bank.json';

import coursesData from '../data/courses.json';

// Import videos
// import electronicsVideo from './assets/Video/Electronics Session 1.mp4';
// import iotVideo from './assets/Video/IoT Session 1.mp4';

interface ActivityData {
  title: string;
  description: string;
  objectives: string[];
  materials: string[];
  steps: string[];
  expectedOutcome: string;
  notes: string;
}

interface ActivityItem {
  day: number;
  topic: string;
  activity_title: string;
  // Format A (Days 1-3): flat instructions array
  // Format B (Day 4+): named sub-activities
  home_activity: {
    instructions?: string[];
    examples?: (string | Record<string, string>)[];
    activity_1?: { title: string; steps?: string[]; instructions?: string[]; examples?: string[] };
    activity_2?: { title: string; description?: string; steps?: string[]; instructions?: string[]; concept?: string; example?: { machine: string; input?: string; action?: string; parts?: string[] } };
    activity_3?: { title: string; steps?: string[]; instructions?: string[]; examples?: string[]; example_answer?: string };
  };
  // Days 1-3
  extra_challenge?: { task: string; examples?: string[] };
  // Day 4+
  extra_exploration?: { task: string; examples?: string[]; questions?: string[]; observation?: string };
  observation_task?: string[];
  // Days 1-3
  think_and_answer?: string[];
  // Day 4+
  think_and_notice?: string[];
  discussion_instruction?: string;
  nep_skills_developed: string[];
  // Days 1-3: string[]; Day 4+: object[]
  learning_outcomes: (string | { id: number; title: string; description: string })[];
  bonus_activity?: string[];
  bonus_mini_activity?: { task: string; instruction?: string; examples?: string[]; include_parts?: string[]; ideas?: string[] };
}

interface Video {
  id: string;
  title: string;
  videoUrl: string;
  description: string;
  contentType?: 'video' | 'quiz' | 'activity';
  quiz?: Quiz;
  activity?: ActivityData;
  activityItem?: ActivityItem;
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
}

interface Quiz {
  id: string;
  questions: QuizQuestion[];
}

type QuizBank = Record<string, QuizQuestion[]>;
type ActivityBank = Record<string, ActivityData>;

interface Day {
  id: string;
  name: string;
  videos: Video[];
}

interface Category {
  id: string;
  title: string;
  icon: string;
  days?: Day[];
  videos: Video[];
}
interface CoursesPageProps {
  onHome?: () => void;
}

// Move static assets and helpers outside the component to prevent re-creation on every render
const VIDEO_ASSETS = (import.meta.env.DEV 
  ? import.meta.glob('../../videos/**/*.mp4', { eager: true, import: 'default' }) 
  : {}) as Record<string, string>;

const quizTemplateQuestions: QuizQuestion[] = [
  {
    id: 'q1',
    question: 'What is the main focus of this electronics lesson?',
    options: ['Sports training', 'Understanding electricity basics', 'Painting techniques', 'Cooking methods'],
    correctOptionIndex: 1
  },
  {
    id: 'q2',
    question: 'Which source can provide electrical energy in basic circuits?',
    options: ['Battery', 'Notebook', 'Wood block', 'Plastic ruler'],
    correctOptionIndex: 0
  },
  {
    id: 'q3',
    question: 'A simple electrical setup works best when components are:',
    options: ['Disconnected', 'Connected in a complete path', 'Placed randomly', 'Painted bright colors'],
    correctOptionIndex: 1
  }
];

const createQuizFromVideo = (video: Video, quizBank: QuizBank): Video => ({
  id: `${video.id}-quiz`,
  title: video.title.includes('Context')
    ? video.title.replace('Context', 'Quiz')
    : `${video.title} Quiz`,
  videoUrl: '',
  description: `${video.description} quiz`,
  contentType: 'quiz',
  quiz: (() => {
    const quizId = `${video.id}-quiz-data`;
    const configuredQuestions = quizBank[quizId];
    const sourceQuestions = configuredQuestions && configuredQuestions.length > 0
      ? configuredQuestions
      : quizTemplateQuestions;

    return {
      id: quizId,
      questions: sourceQuestions.map((question) => ({
        ...question,
        options: [...question.options]
      }))
    };
  })()
});

const addQuizAfterEachVideo = (videos: Video[], quizBank: QuizBank): Video[] => {
  return videos.flatMap((video) => [video, createQuizFromVideo(video, quizBank)]);
};

const createUnifiedActivityForDay = (moduleId: string, dayNum: number, bankData: any): Video[] => {
  if (!bankData || !bankData.activities || !Array.isArray(bankData.activities)) return [];
  const activities = bankData.activities as ActivityItem[];
  const item = activities.find((a) => a.day === dayNum);
  if (!item) return [];
  return [{
    id: `${moduleId}-day-${dayNum}-activity-1`,
    title: `Activity: ${item.activity_title}`,
    videoUrl: '',
    description: item.topic,
    contentType: 'activity',
    activityItem: item
  }];
};

const resolveVideoUrl = (path: string): string => {
  if (!path) return '';

  // In Production Mode (.deb), force secure protocol for encrypted assets
  if (import.meta.env.PROD && (window as any).electronAPI) {
      // Preserve the full path from @/assets/videos/ to find nested assets
      const subPath = path.replace(/^@\/assets\/videos\//, '').replace('.mp4', '.lmsx');
      return `lms-secure://${subPath}`;
  }

  const normalizedPath = path.includes('/assets/videos/') 
    ? path.replace(/^@\/assets\/videos\//, '../../videos/')
    : path.replace(/^@\//, '../');
  
  return VIDEO_ASSETS[normalizedPath] || path;
};

const generateCategoryDays = (moduleId: string, quizBank: QuizBank): Day[] => {
  const courseData = (coursesData as any).courses?.[moduleId];
  if (!courseData) return [];
  const dayKeys = Object.keys(courseData)
    .filter(key => /^Day\d+$/.test(key))
    .sort((a, b) => {
      const numA = parseInt(a.replace('Day', ''), 10);
      const numB = parseInt(b.replace('Day', ''), 10);
      return numA - numB;
    });
  const days: Day[] = dayKeys.map((dayKey) => {
    const dayNumber = parseInt(dayKey.replace('Day', ''), 10);
    const jsonVideos = courseData[dayKey];
    if (!jsonVideos || jsonVideos.length === 0) {
      return { id: `${moduleId}-day-${dayNumber}`, name: `Day ${dayNumber}`, videos: [] };
    }
    const baseTopics: Video[] = jsonVideos.map((item: any) => ({
      id: item.id,
      title: item.title,
      videoUrl: resolveVideoUrl(item.context1),
      description: item.description || `Day ${dayNumber} topic`
    }));
    let finalVideos = addQuizAfterEachVideo(baseTopics, quizBank);
    const bankMap: Record<string, any> = {
      'electronics': electronicsActivityBank,
      'robotics': roboticsActivityBank,
      'drone': droneActivityBank,
      'iot': iotActivityBank,
      'ai': aiActivityBank,
      'ar': arActivityBank,
      'ar-vr': arActivityBank,
      'arvr': arActivityBank,
      'vr': vrActivityBank,
      'mr': mrActivityBank,
      '3d-printing': printingActivityBank,
      '3d_printing': printingActivityBank,
      '3dprinting': printingActivityBank
    };
    const selectedBank = bankMap[moduleId];
    if (selectedBank) {
      const activity = createUnifiedActivityForDay(moduleId, dayNumber, selectedBank);
      if (activity.length > 0) finalVideos = [...finalVideos, ...activity];
    }
    return { id: `${moduleId}-day-${dayNumber}`, name: `Day ${dayNumber}`, videos: finalVideos };
  });
  return days;
};

// MEMOIZED SIDEBAR COMPONENTS - Prevents expensive re-renders
const SidebarVideoItem = memo(({ 
  video, 
  isSelected, 
  isCompleted, 
  unlocked, 
  onClick 
}: { 
  video: Video; 
  isSelected: boolean; 
  isCompleted: boolean; 
  unlocked: boolean; 
  onClick: (video: Video) => void;
}) => (
  <div className="video-branch-item" style={{ position: 'relative' }}>
    <div className={`topic-branch ${isSelected ? 'active-branch' : ''} ${video.contentType === 'quiz' ? 'is-quiz' : ''}`} />
    <button
      className={`video-item ${isSelected ? 'active' : ''} ${isCompleted ? 'completed' : 'incomplete'} ${!unlocked ? 'locked' : ''}`}
      onClick={() => unlocked && onClick(video)}
      disabled={!unlocked}
    >
      <span className="video-icon">
        {video.contentType === 'quiz' ? '❓' : video.contentType === 'activity' ? '📝' : '🎥'}
      </span>
      <span className="video-title">{video.title}</span>
      {!unlocked && <span className="lock-icon" style={{ marginLeft: 'auto' }}>🔒</span>}
    </button>
  </div>
));

const SidebarDayItem = memo(({ 
  day, 
  isExpanded, 
  selectedVideoId, 
  completedVideos, 
  isUnlocked, 
  onToggle, 
  onVideoClick,
  dayRef 
}: { 
  day: Day; 
  isExpanded: boolean; 
  selectedVideoId?: string; 
  completedVideos: string[]; 
  isUnlocked: (video: Video) => boolean;
  onToggle: (id: string) => void;
  onVideoClick: (video: Video) => void;
  dayRef: (el: HTMLDivElement | null) => void;
}) => {
  const activeTopicIndex = useMemo(() => day.videos.findIndex(v => v.id === selectedVideoId), [day.videos, selectedVideoId]);
  
  const progressPercent = useMemo(() => {
    if (activeTopicIndex === -1) return 0;
    const itemHeight = 40;
    const offset = 20;
    const highlightHeight = (activeTopicIndex * itemHeight) + (itemHeight / 2) + offset;
    return (highlightHeight / (day.videos.length * itemHeight)) * 100;
  }, [activeTopicIndex, day.videos.length]);

  return (
    <div className={`tree-branch-container ${isExpanded ? 'active' : ''}`} ref={dayRef}>
      <div className={`day-branch ${isExpanded ? 'active-branch' : ''}`} />
      <button className={`day-button ${isExpanded ? 'expanded' : ''}`} onClick={() => onToggle(day.id)}>
        <span className="indicator-dot" style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: isExpanded ? '#5c4fb7' : '#e5e7eb', marginRight: '8px'
        }} />
        <span className="day-title">{day.name}</span>
        <span className={`day-arrow ${isExpanded ? 'open' : ''}`} style={{ marginLeft: 'auto', fontSize: '10px', opacity: 0.5 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points={isExpanded ? "18 15 12 9 6 15" : "9 18 15 12 9 6"}></polyline>
          </svg>
        </span>
      </button>

      <div className={`day-videos ${isExpanded ? 'show' : ''}`}>
        <div className="topic-branch-container">
          <div className="topic-spine" />
          {activeTopicIndex !== -1 && (
            <div className="topic-spine-filled" style={{ height: `${progressPercent}%`, zIndex: 0 }} />
          )}
          {day.videos.length > 0 ? (
            day.videos.map((video) => (
              <SidebarVideoItem 
                key={video.id}
                video={video}
                isSelected={selectedVideoId === video.id}
                isCompleted={completedVideos.includes(video.id)}
                unlocked={isUnlocked(video)}
                onClick={onVideoClick}
              />
            ))
          ) : (
            <div className="no-videos-message"><span>No videos for this day</span></div>
          )}
        </div>
      </div>
    </div>
  );
});

const SidebarCategoryItem = memo(({
  category,
  expandedCategoryId,
  expandedDays,
  selectedVideoId,
  completedVideos,
  activeDaySpineHeight,
  isUnlocked,
  toggleCategory,
  toggleDay,
  handleVideoClick,
  dayRowRefs
}: {
  category: Category;
  expandedCategoryId: string | null;
  expandedDays: string[];
  selectedVideoId?: string;
  completedVideos: string[];
  activeDaySpineHeight: number;
  isUnlocked: (video: Video) => boolean;
  toggleCategory: (id: string) => void;
  toggleDay: (id: string) => void;
  handleVideoClick: (video: Video) => void;
  dayRowRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
}) => {
  const isExpanded = expandedCategoryId === category.id;

  return (
    <div className="category-item">
      <button
        className={`category-button ${isExpanded ? 'expanded' : ''}`}
        onClick={() => toggleCategory(category.id)}
      >
        <span className="category-icon">{category.icon}</span>
        <span className="category-title">{category.title}</span>
        <span className={`dropdown-arrow ${isExpanded ? 'open' : ''}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </span>
      </button>

      <div className={`subcategories ${isExpanded ? 'show' : ''}`}>
        <div className="tree-container">
          <div
            className="tree-spine"
            style={activeDaySpineHeight > 0 ? {
              background: `linear-gradient(to bottom, #000000 0, #000000 ${activeDaySpineHeight}px, #94a3b8 ${activeDaySpineHeight}px, #94a3b8 100%)`
            } : undefined}
          />
          {category.days && category.days.length > 0 ? (
            category.days.map((day) => (
              <SidebarDayItem 
                key={day.id}
                day={day}
                isExpanded={expandedDays.includes(day.id)}
                selectedVideoId={selectedVideoId}
                completedVideos={completedVideos}
                isUnlocked={isUnlocked}
                onToggle={toggleDay}
                onVideoClick={handleVideoClick}
                dayRef={(el) => { dayRowRefs.current[day.id] = el; }}
              />
            ))
          ) : category.videos.length > 0 ? (
            category.videos.map((video) => (
              <SidebarVideoItem 
                key={video.id}
                video={video}
                isSelected={selectedVideoId === video.id}
                isCompleted={completedVideos.includes(video.id)}
                unlocked={isUnlocked(video)}
                onClick={handleVideoClick}
              />
            ))
          ) : (
            <div className="no-videos-message">
              <span>No videos available yet</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

function CoursesPage({ onHome }: CoursesPageProps) {
  const quizBank: QuizBank = electronicsQuizBank as QuizBank;
  const navigate = useNavigate();
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [expandedDays, setExpandedDays] = useState<string[]>([]);
  const [completedVideos, setCompletedVideos] = useState<string[]>(() => {
    const saved = localStorage.getItem('completedVideos');
    return saved ? JSON.parse(saved) : [];
  });
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [submittedQuizzes, setSubmittedQuizzes] = useState<Record<string, boolean>>({});
  const [contentVisible, setContentVisible] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [activeDaySpineHeight, setActiveDaySpineHeight] = useState(0);
  const dayRowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // MEMOIZED Course Data Calculation: Only happens once, making the page load in milliseconds
  const categories: Category[] = useMemo(() => [
    { id: 'electronics', title: 'Electronics', icon: '⚡', days: generateCategoryDays('electronics', quizBank), videos: [] as Video[] },
    { id: 'robotics', title: 'Robotics', icon: '🤖', days: generateCategoryDays('robotics', quizBank), videos: [] as Video[] },
    { id: 'drone', title: 'Drone', icon: '🚁', days: generateCategoryDays('drone', quizBank), videos: [] as Video[] },
    { id: 'iot', title: 'IoT (Internet of Things)', icon: '🌐', days: generateCategoryDays('iot', quizBank), videos: [] as Video[] },
    { id: 'arvr', title: 'AR (Augmented Reality)', icon: '🥽', days: generateCategoryDays('ar-vr', quizBank), videos: [] as Video[] },
    { id: 'vr', title: 'VR (Virtual Reality)', icon: '🥽', days: generateCategoryDays('vr', quizBank), videos: [] as Video[] },
    { id: 'mr', title: 'MR (Mixed Reality)', icon: '🧩', days: generateCategoryDays('mr', quizBank), videos: [] as Video[] },
    { id: '3d-printing', title: '3D Printing', icon: '🖨️', days: generateCategoryDays('3d-printing', quizBank), videos: [] as Video[] },
    { id: 'ai', title: 'AI (Artificial Intelligence)', icon: '🧠', days: generateCategoryDays('ai', quizBank), videos: [] as Video[] }
  ], [quizBank]);

  const failImage = new URL('../assets/images/Fail.png', import.meta.url).href;
  const inbetweenImage = new URL('../assets/images/inbetween.png', import.meta.url).href;
  const passImage = new URL('../assets/images/pass.png', import.meta.url).href;

  // ... more logic follows

  const findVideoContext = (videoId: string) => {
    for (const category of categories) {
      // Check category-level videos
      if (category.videos.some(v => v.id === videoId)) {
        return { categoryId: category.id, dayId: null };
      }
      // Check day-level videos
      if (category.days) {
        for (const day of category.days) {
          if (day.videos.some(v => v.id === videoId)) {
            return { categoryId: category.id, dayId: day.id };
          }
        }
      }
    }
    return null;
  };

  const toggleCategory = (categoryId: string) => {
    if (expandedCategory === categoryId) {
      setExpandedCategory(null);
      setExpandedDays([]);
    } else {
      setExpandedCategory(categoryId);
      setExpandedDays([]);
    }
  };

  const toggleDay = (dayId: string) => {
    setExpandedDays(prev =>
      prev.includes(dayId) ? [] : [dayId]
    );
  };

  const switchContent = (video: Video) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setContentVisible(false);
    setTimeout(() => {
      setSelectedVideo(video);
      localStorage.setItem('lastWatchedVideoId', video.id);
      setContentVisible(true);
      setIsTransitioning(false);
    }, 220);
  };

  const handleVideoClick = (video: Video) => {
    if (selectedVideo?.id === video.id) return;
    switchContent(video);
    console.log('Selected video:', video.title);
  };
  // Load last watched video on mount
  useEffect(() => {
    const lastWatchedId = localStorage.getItem('lastWatchedVideoId');
    if (lastWatchedId) {
      const allVideos = getAllVideos();
      const lastVideo = allVideos.find(v => v.id === lastWatchedId);
      if (lastVideo) {
        setSelectedVideo(lastVideo);
      }
    }
  }, []);

  // Persist completed videos
  useEffect(() => {
    localStorage.setItem('completedVideos', JSON.stringify(completedVideos));
  }, [completedVideos]);

  // Auto-expand sidebar when selectedVideo changes
  useEffect(() => {
    if (selectedVideo) {
      const context = findVideoContext(selectedVideo.id);
      if (context) {
        setExpandedCategory(context.categoryId);
        if (context.dayId) {
          // Accordion style: only the new day remains open when auto-advancing
          setExpandedDays([context.dayId!]);
        }
      }
    }
  }, [selectedVideo]);

  useLayoutEffect(() => {
    const updateActiveDaySpine = () => {
      // Find the furthest day that has completed content
      const lastCompletedVideoId = completedVideos.length > 0 ? completedVideos[completedVideos.length - 1] : null;
      let progressDayId = null;
      
      if (lastCompletedVideoId) {
        const context = findVideoContext(lastCompletedVideoId);
        progressDayId = context?.dayId;
      }

      const activeDayRow = progressDayId ? dayRowRefs.current[progressDayId] : null;

      if (!activeDayRow) {
        setActiveDaySpineHeight(0);
        return;
      }

      // Stop the dark spine at the active day's elbow, not inside its opened content.
      setActiveDaySpineHeight(activeDayRow.offsetTop + 14);
    };

    updateActiveDaySpine();
    window.addEventListener('resize', updateActiveDaySpine);

    return () => {
      window.removeEventListener('resize', updateActiveDaySpine);
    };
  }, [expandedCategory, expandedDays, selectedVideo, completedVideos]);

  // Mark video as completed when it ends
  const handleVideoEnded = () => {
    if (selectedVideo && !completedVideos.includes(selectedVideo.id)) {
      setCompletedVideos((prev) => [...prev, selectedVideo.id]);
    }
    // Auto-advance after video ends
    setTimeout(() => {
      handleNext();
    }, 300);
  };

  const getAllVideos = (): Video[] => {
    return categories.flatMap((category) => [
      ...category.videos,
      ...(category.days?.flatMap((day) => day.videos) ?? [])
    ]);
  };

  const isUnlocked = (video: Video) => {
    const allVideos = getAllVideos();
    const index = allVideos.findIndex(v => v.id === video.id);
    if (index <= 0) return true;
    return completedVideos.includes(allVideos[index - 1].id);
  };

  const getCurrentVideoIndex = (): number => {
    if (!selectedVideo) return -1;
    return getAllVideos().findIndex(video => video.id === selectedVideo.id);
  };

  const handlePrevious = () => {
    const allVideos = getAllVideos();
    const currentIndex = getCurrentVideoIndex();
    if (currentIndex > 0) {
      switchContent(allVideos[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    // Activities complete naturally when moving to next
    if (selectedVideo?.contentType === 'activity' && !completedVideos.includes(selectedVideo.id)) {
      setCompletedVideos(prev => [...prev, selectedVideo.id]);
    }

    const allVideos = getAllVideos();
    const currentIndex = getCurrentVideoIndex();
    if (currentIndex < allVideos.length - 1) {
      switchContent(allVideos[currentIndex + 1]);
    }
  };

  const handleRepeat = () => {
    if (selectedVideo) {
      const videoElement = document.querySelector('.video-player') as HTMLVideoElement;
      if (videoElement) {
        videoElement.currentTime = 0;
        videoElement.play();
      }
    }
  };

  const handleQuizAnswerSelect = (questionId: string, optionIndex: number) => {
    if (!selectedVideo?.quiz) return;
    const answerKey = `${selectedVideo.id}:${questionId}`;
    setQuizAnswers((prev) => ({ ...prev, [answerKey]: optionIndex }));
  };

  const handleQuizSubmit = () => {
    if (!selectedVideo?.quiz) return;

    const totalQuestions = selectedVideo.quiz.questions.length;
    const score = selectedVideo.quiz.questions.reduce((total, question) => {
      const selectedAnswer = quizAnswers[`${selectedVideo.id}:${question.id}`];
      return selectedAnswer === question.correctOptionIndex ? total + 1 : total;
    }, 0);

    const resultType = score === 0 ? 'fail' : score === totalQuestions ? 'pass' : 'inbetween';

    try {
      const audioContext = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

      const now = audioContext.currentTime;

      if (resultType === 'pass') {
        [0, 0.12, 0.24].forEach((offset, index) => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          const frequencies = [523.25, 659.25, 783.99];

          oscillator.type = 'triangle';
          oscillator.frequency.setValueAtTime(frequencies[index], now + offset);

          const noteStart = now + offset;
          const noteEnd = noteStart + 0.16;

          gainNode.gain.setValueAtTime(0.0001, noteStart);
          gainNode.gain.exponentialRampToValueAtTime(0.18, noteStart + 0.02);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);

          oscillator.start(noteStart);
          oscillator.stop(noteEnd);
        });
      } else if (resultType === 'inbetween') {
        [0, 0.2].forEach((offset, index) => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          const frequencies = [220, 261.63];

          oscillator.type = 'square';
          oscillator.frequency.setValueAtTime(frequencies[index], now + offset);

          const noteStart = now + offset;
          const noteEnd = noteStart + 0.18;

          gainNode.gain.setValueAtTime(0.0001, noteStart);
          gainNode.gain.exponentialRampToValueAtTime(0.14, noteStart + 0.02);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);

          oscillator.start(noteStart);
          oscillator.stop(noteEnd);
        });
      } else {
        [0, 0.22].forEach((offset) => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();

          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(130, now + offset);
          oscillator.frequency.exponentialRampToValueAtTime(70, now + offset + 0.18);

          const noteStart = now + offset;
          const noteEnd = noteStart + 0.22;

          gainNode.gain.setValueAtTime(0.0001, noteStart);
          gainNode.gain.exponentialRampToValueAtTime(0.25, noteStart + 0.02);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);

          oscillator.start(noteStart);
          oscillator.stop(noteEnd);
        });
      }
    } catch (error) {
      console.warn('Quiz submit sound could not be played:', error);
    }

    setSubmittedQuizzes((prev) => ({ ...prev, [selectedVideo.id]: true }));

    if (!completedVideos.includes(selectedVideo.id)) {
      setCompletedVideos((prev) => [...prev, selectedVideo.id]);
    }

    // Auto-advance after passing quiz
    if (resultType === 'pass') {
      setTimeout(() => {
        handleNext();
      }, 300);
    }
  };

  const getQuizScore = (video: Video): { score: number; total: number } => {
    if (!video.quiz) {
      return { score: 0, total: 0 };
    }

    const score = video.quiz.questions.reduce((total, question) => {
      const selectedAnswer = quizAnswers[`${video.id}:${question.id}`];
      return selectedAnswer === question.correctOptionIndex ? total + 1 : total;
    }, 0);

    return { score, total: video.quiz.questions.length };
  };

  const getQuizResultImage = (video: Video): string => {
    const { score, total } = getQuizScore(video);
    if (score === 0) return failImage;
    if (score === total) return passImage;
    return inbetweenImage;
  };

  const renderActivityItem = (item: ActivityItem) => {
    return (
      <div className="activity-item-rich">
        <div className="activity-main-profile">
          <div className="activity-header-mini-badge">
            <span className="badge-icon">🌟</span>
            <span className="badge-text">Main Activity</span>
          </div>

          <h2 className="activity-rich-title">{item.activity_title}</h2>
          <p className="activity-rich-topic"><strong>Topic:</strong> {item.topic}</p>

          <div className="activity-card home-activity-card">
            <h3 className="card-title">🏠 Home Activity</h3>

            {item.home_activity.instructions && (
              <div className="instruction-block">
                <ul className="instruction-list">
                  {item.home_activity.instructions.map((inst, i) => (
                    <li key={i}>{inst}</li>
                  ))}
                </ul>
              </div>
            )}

            {['activity_1', 'activity_2', 'activity_3'].map(key => {
              const subAct = (item.home_activity as any)[key];
              if (!subAct) return null;
              return (
                <div key={key} className="sub-activity-block">
                  <h4 className="sub-act-title">{subAct.title}</h4>
                  {subAct.description && <p className="sub-act-desc">{subAct.description}</p>}
                  {subAct.instructions && (
                    <ul className="sub-act-list">
                      {subAct.instructions.map((s: string, i: number) => <li key={i}>{s}</li>)}
                    </ul>
                  )}
                  {subAct.steps && (
                    <ol className="sub-act-steps">
                      {subAct.steps.map((s: string, i: number) => <li key={i}>{s}</li>)}
                    </ol>
                  )}
                  {subAct.examples && (
                    <div className="example-box">
                      <strong>Examples:</strong> {subAct.examples.join(', ')}
                    </div>
                  )}
                </div>
              );
            })}

            {item.home_activity.examples && (
              <div className="example-section">
                <span className="example-label">💡 Examples:</span>
                <div className="example-items">
                  {item.home_activity.examples.map((ex, i) => (
                    <span key={i} className="example-tag">
                      {typeof ex === 'string' ? ex : `${ex.switch}: ${ex.device}`}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {(item.extra_challenge || item.extra_exploration || item.observation_task) && (
            <div className="activity-card challenge-card">
              <h3 className="card-title">🚀 Extra Challenge</h3>
              <p className="challenge-task">
                {item.extra_challenge?.task || item.extra_exploration?.task || (item.observation_task && item.observation_task[0])}
              </p>
              {(item.extra_challenge?.examples || item.extra_exploration?.examples) && (
                <div className="example-section">
                  <span className="example-label">Examples:</span>
                  {(item.extra_challenge?.examples || item.extra_exploration?.examples)?.map((ex: any, i: number) => (
                    <span key={i} className="example-tag">{ex}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {(item.think_and_answer || item.think_and_notice) && (
            <div className="activity-card reflection-card">
              <h3 className="card-title">🧠 Think and Reflect</h3>
              <ul className="reflection-list">
                {(item.think_and_answer || item.think_and_notice)?.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
              {item.discussion_instruction && (
                <p className="discussion-note">🗣️ {item.discussion_instruction}</p>
              )}
            </div>
          )}

          <div className="activity-meta-grid">
            <div className="meta-card outcomes-card">
              <h4>🎯 Learning Outcomes</h4>
              <ul className="meta-list">
                {item.learning_outcomes.map((lo, i) => (
                  <li key={i}>{typeof lo === 'string' ? lo : lo.title}</li>
                ))}
              </ul>
            </div>
            <div className="meta-card skills-card">
              <h4>🛠️ NEP Skills</h4>
              <div className="skill-tags">
                {item.nep_skills_developed.map((skill, i) => (
                  <span key={i} className="skill-tag">{skill}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {(item.bonus_activity || item.bonus_mini_activity) && (
          <div className="activity-bonus-profile">
            <div className="activity-header-mini-badge bonus-badge">
              <span className="badge-icon">🎁</span>
              <span className="badge-text">Bonus Activity</span>
            </div>
            <div className="bonus-content-card">
              {item.bonus_activity && (
                <ul className="bonus-list">
                  {item.bonus_activity.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              )}
              {item.bonus_mini_activity && (
                <div className="mini-bonus">
                  <p><strong>Task:</strong> {item.bonus_mini_activity.task}</p>
                  {item.bonus_mini_activity.instruction && <p>{item.bonus_mini_activity.instruction}</p>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="courses-page">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>Learning Library</h2>
          <p className="sidebar-subtitle">Browse courses & videos</p>
        </div>

        <div className="categories-list">
          {categories.map((category) => (
            <SidebarCategoryItem 
              key={category.id}
              category={category}
              expandedCategoryId={expandedCategory}
              expandedDays={expandedDays}
              selectedVideoId={selectedVideo?.id}
              completedVideos={completedVideos}
              activeDaySpineHeight={activeDaySpineHeight}
              isUnlocked={isUnlocked}
              toggleCategory={toggleCategory}
              toggleDay={toggleDay}
              handleVideoClick={handleVideoClick}
              dayRowRefs={dayRowRefs}
            />
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="main-content">
        <div className={`content-transition-wrapper ${contentVisible ? 'content-visible' : 'content-hidden'}`}>
          {selectedVideo ? (
            <div className="video-content">
              <button className="home-btn" onClick={() => navigate('/learning')} title="Go Home">
                <span className="home-icon">🏠</span>
              </button>
              <div className="video-header">
                <h2>{selectedVideo.title}</h2>
                <p className="video-description">{selectedVideo.description}</p>
              </div>
              {selectedVideo.contentType === 'activity' && selectedVideo.activityItem ? (
                <div className="activity-wrapper">
                  {/* Topic banner */}
                  <div className="activity-topic-banner">
                    <span className="activity-topic-label">📚 Topic:</span>
                    <span className="activity-topic-text">{selectedVideo.activityItem.topic}</span>
                  </div>

                  {/* Home Activity — Format A: flat instructions */}
                  {selectedVideo.activityItem.home_activity.instructions && selectedVideo.activityItem.home_activity.instructions.length > 0 && (
                    <div className="activity-section">
                      <h3 className="activity-section-title">🏠 Home Activity</h3>
                      <ol className="activity-steps-list">
                        {selectedVideo.activityItem.home_activity.instructions.map((instr, i) => (
                          <li key={i}>{instr}</li>
                        ))}
                      </ol>
                      {selectedVideo.activityItem.home_activity.examples && selectedVideo.activityItem.home_activity.examples.length > 0 && (
                        <div className="activity-examples-block">
                          <span className="activity-examples-label">💡 Examples: </span>
                          {selectedVideo.activityItem.home_activity.examples.map((ex, i) => (
                            typeof ex === 'string'
                              ? <span key={i} className="activity-chip">{ex}</span>
                              : <span key={i} className="activity-chip">{Object.values(ex as Record<string, string>).join(' → ')}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Home Activity — Format B: named sub-activities */}
                  {(selectedVideo.activityItem.home_activity.activity_1 || selectedVideo.activityItem.home_activity.activity_2) && (
                    <div className="activity-section">
                      <h3 className="activity-section-title">🏠 Home Activity</h3>
                      {selectedVideo.activityItem.home_activity.activity_1 && (() => {
                        const a1 = selectedVideo.activityItem.home_activity.activity_1!;
                        const a1Items = a1.steps || a1.instructions || [];
                        return (
                          <div className="activity-sub-block">
                            <p className="activity-sub-title">🔵 {a1.title}</p>
                            {a1Items.length > 0 && (
                              <ol className="activity-steps-list">
                                {a1Items.map((s, i) => <li key={i}>{s}</li>)}
                              </ol>
                            )}
                            {a1.examples && a1.examples.length > 0 && (
                              <div className="activity-examples-block">
                                {a1.examples.map((ex, i) => <span key={i} className="activity-chip">{ex}</span>)}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {selectedVideo.activityItem.home_activity.activity_2 && (() => {
                        const a2 = selectedVideo.activityItem.home_activity.activity_2!;
                        const a2Items = a2.steps || a2.instructions || [];
                        return (
                          <div className="activity-sub-block">
                            <p className="activity-sub-title">🟢 {a2.title}</p>
                            {a2.description && <p className="activity-description-text">{a2.description}</p>}
                            {a2Items.length > 0 && (
                              <ol className="activity-steps-list">
                                {a2Items.map((s, i) => <li key={i}>{s}</li>)}
                              </ol>
                            )}
                            {a2.concept && <p className="activity-discussion-note">💡 {a2.concept}</p>}
                            {a2.example && (
                              <div className="activity-examples-block">
                                <span className="activity-chip">🔧 {a2.example.machine}</span>
                                {a2.example.input && <span className="activity-chip">⚡ Input: {a2.example.input}</span>}
                                {a2.example.action && <span className="activity-chip">✅ Action: {a2.example.action}</span>}
                                {a2.example.parts && a2.example.parts.map((p, i) => <span key={i} className="activity-chip">{p}</span>)}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {selectedVideo.activityItem.home_activity.activity_3 && (() => {
                        const a3 = selectedVideo.activityItem.home_activity.activity_3!;
                        const a3Items = a3.steps || a3.instructions || [];
                        return (
                          <div className="activity-sub-block">
                            <p className="activity-sub-title">🟠 {a3.title}</p>
                            {a3Items.length > 0 && (
                              <ol className="activity-steps-list">
                                {a3Items.map((s, i) => <li key={i}>{s}</li>)}
                              </ol>
                            )}
                            {a3.examples && a3.examples.length > 0 && (
                              <div className="activity-examples-block">
                                {a3.examples.map((ex, i) => <span key={i} className="activity-chip">{ex}</span>)}
                              </div>
                            )}
                            {a3.example_answer && <p className="activity-discussion-note">✏️ Example Answer: {a3.example_answer}</p>}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Observation Task */}
                  {selectedVideo.activityItem.observation_task && selectedVideo.activityItem.observation_task.length > 0 && (
                    <div className="activity-section">
                      <h3 className="activity-section-title">🔍 Observation Task</h3>
                      <ol className="activity-steps-list">
                        {selectedVideo.activityItem.observation_task.map((task, i) => (
                          <li key={i}>{task}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Extra Challenge (Days 1-3) */}
                  {selectedVideo.activityItem.extra_challenge && (
                    <div className="activity-section activity-section-challenge">
                      <h3 className="activity-section-title">⭐ Extra Challenge</h3>
                      <p className="activity-description-text">{selectedVideo.activityItem.extra_challenge.task}</p>
                      {selectedVideo.activityItem.extra_challenge.examples && selectedVideo.activityItem.extra_challenge.examples.length > 0 && (
                        <div className="activity-examples-block">
                          <span className="activity-examples-label">💡 Examples: </span>
                          {selectedVideo.activityItem.extra_challenge.examples.map((ex, i) => (
                            <span key={i} className="activity-chip">{ex}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Extra Exploration (Day 4+) */}
                  {selectedVideo.activityItem.extra_exploration && (
                    <div className="activity-section activity-section-challenge">
                      <h3 className="activity-section-title">🔬 Extra Exploration</h3>
                      <p className="activity-description-text">{selectedVideo.activityItem.extra_exploration.task}</p>
                      {selectedVideo.activityItem.extra_exploration.questions && selectedVideo.activityItem.extra_exploration.questions.length > 0 && (
                        <ul className="activity-think-list">
                          {selectedVideo.activityItem.extra_exploration.questions.map((q, i) => (
                            <li key={i}><span className="activity-q-number">Q{i + 1}.</span> {q}</li>
                          ))}
                        </ul>
                      )}
                      {selectedVideo.activityItem.extra_exploration.examples && selectedVideo.activityItem.extra_exploration.examples.length > 0 && (
                        <div className="activity-examples-block">
                          <span className="activity-examples-label">💡 Examples: </span>
                          {selectedVideo.activityItem.extra_exploration.examples.map((ex, i) => (
                            <span key={i} className="activity-chip">{ex}</span>
                          ))}
                        </div>
                      )}
                      {selectedVideo.activityItem.extra_exploration.observation && (
                        <p className="activity-discussion-note">👁️ {selectedVideo.activityItem.extra_exploration.observation}</p>
                      )}
                    </div>
                  )}

                  {/* Think & Answer (Days 1-3) */}
                  {selectedVideo.activityItem.think_and_answer && selectedVideo.activityItem.think_and_answer.length > 0 && (
                    <div className="activity-section">
                      <h3 className="activity-section-title">🤔 Think &amp; Answer</h3>
                      <ul className="activity-think-list">
                        {selectedVideo.activityItem.think_and_answer.map((q, i) => (
                          <li key={i}><span className="activity-q-number">Q{i + 1}.</span> {q}</li>
                        ))}
                      </ul>
                      {selectedVideo.activityItem.discussion_instruction && (
                        <p className="activity-discussion-note">💬 {selectedVideo.activityItem.discussion_instruction}</p>
                      )}
                    </div>
                  )}

                  {/* Think & Notice (Day 4+) */}
                  {selectedVideo.activityItem.think_and_notice && selectedVideo.activityItem.think_and_notice.length > 0 && (
                    <div className="activity-section">
                      <h3 className="activity-section-title">🤔 Think &amp; Notice</h3>
                      <ul className="activity-think-list">
                        {selectedVideo.activityItem.think_and_notice.map((q, i) => (
                          <li key={i}><span className="activity-q-number">Q{i + 1}.</span> {q}</li>
                        ))}
                      </ul>
                      {selectedVideo.activityItem.discussion_instruction && (
                        <p className="activity-discussion-note">💬 {selectedVideo.activityItem.discussion_instruction}</p>
                      )}
                    </div>
                  )}

                  {/* NEP Skills */}
                  {selectedVideo.activityItem.nep_skills_developed && selectedVideo.activityItem.nep_skills_developed.length > 0 && (
                    <div className="activity-section">
                      <h3 className="activity-section-title">🧠 NEP Skills Developed</h3>
                      <div className="activity-chips-row">
                        {selectedVideo.activityItem.nep_skills_developed.map((skill, i) => (
                          <span key={i} className="activity-skill-chip">{skill}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Learning Outcomes — handles both string[] and object[] */}
                  {selectedVideo.activityItem.learning_outcomes && selectedVideo.activityItem.learning_outcomes.length > 0 && (
                    <div className="activity-section">
                      <h3 className="activity-section-title">🎯 Learning Outcomes</h3>
                      <ul className="activity-list">
                        {selectedVideo.activityItem.learning_outcomes.map((lo, i) => (
                          typeof lo === 'string'
                            ? <li key={i}>✔ {lo}</li>
                            : <li key={i}>✔ <strong>{(lo as { title: string; description: string }).title}</strong> — {(lo as { title: string; description: string }).description}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Bonus Activity */}
                  {selectedVideo.activityItem.bonus_activity && selectedVideo.activityItem.bonus_activity.length > 0 && (
                    <div className="activity-section activity-section-bonus">
                      <h3 className="activity-section-title">🌟 Bonus Activity</h3>
                      <ul className="activity-list">
                        {selectedVideo.activityItem.bonus_activity.map((bonus, i) => (
                          <li key={i}>{bonus}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedVideo.activityItem.bonus_mini_activity && (
                    <div className="activity-section activity-section-bonus">
                      <h3 className="activity-section-title">🌟 Bonus Mini Activity</h3>
                      <p className="activity-description-text">📌 {selectedVideo.activityItem.bonus_mini_activity.task}</p>
                      {selectedVideo.activityItem.bonus_mini_activity.include_parts && selectedVideo.activityItem.bonus_mini_activity.include_parts.length > 0 && (
                        <div className="activity-examples-block">
                          <span className="activity-examples-label">🧩 Parts: </span>
                          {selectedVideo.activityItem.bonus_mini_activity.include_parts.map((p, i) => (
                            <span key={i} className="activity-chip">{p}</span>
                          ))}
                        </div>
                      )}
                      {selectedVideo.activityItem.bonus_mini_activity.ideas && selectedVideo.activityItem.bonus_mini_activity.ideas.length > 0 && (
                        <div className="activity-examples-block">
                          <span className="activity-examples-label">💡 Ideas: </span>
                          {selectedVideo.activityItem.bonus_mini_activity.ideas.map((idea, i) => (
                            <span key={i} className="activity-chip">{idea}</span>
                          ))}
                        </div>
                      )}
                      {selectedVideo.activityItem.bonus_mini_activity.examples && selectedVideo.activityItem.bonus_mini_activity.examples.length > 0 && (
                        <div className="activity-examples-block">
                          {selectedVideo.activityItem.bonus_mini_activity.examples.map((ex, i) => (
                            <span key={i} className="activity-chip">{ex}</span>
                          ))}
                        </div>
                      )}
                      {selectedVideo.activityItem.bonus_mini_activity.instruction && (
                        <p className="activity-description-text">💡 {selectedVideo.activityItem.bonus_mini_activity.instruction}</p>
                      )}
                    </div>
                  )}
                </div>
              ) : selectedVideo.contentType === 'activity' && selectedVideo.activity ? (
                <div className="activity-wrapper">
                  {selectedVideo.activityItem ? (
                    renderActivityItem(selectedVideo.activityItem)
                  ) : selectedVideo.activity && (
                    <>
                      <div className="activity-section">
                        <h3 className="activity-section-title">📋 Description</h3>
                        <p className="activity-description-text">{selectedVideo.activity.description}</p>
                      </div>
                      <div className="activity-section">
                        <h3 className="activity-section-title">🎯 Objectives</h3>
                        <ul className="activity-list">
                          {selectedVideo.activity.objectives.map((obj, i) => (<li key={i}>{obj}</li>))}
                        </ul>
                      </div>
                      <div className="activity-section">
                        <h3 className="activity-section-title">🧰 Materials Needed</h3>
                        <ul className="activity-list">
                          {selectedVideo.activity.materials.map((mat, i) => (<li key={i}>{mat}</li>))}
                        </ul>
                      </div>
                      <div className="activity-section">
                        <h3 className="activity-section-title">🪜 Steps</h3>
                        <ol className="activity-steps-list">
                          {selectedVideo.activity.steps.map((step, i) => (<li key={i}>{step}</li>))}
                        </ol>
                      </div>
                      <div className="activity-section">
                        <h3 className="activity-section-title">✅ Expected Outcome</h3>
                        <p className="activity-outcome-text">{selectedVideo.activity.expectedOutcome}</p>
                      </div>
                    </>
                  )}
                </div>
              ) : selectedVideo.contentType === 'quiz' && selectedVideo.quiz ? (
                <div className="quiz-wrapper">
                  {!submittedQuizzes[selectedVideo.id] ? (
                    <>
                      {selectedVideo.quiz.questions.map((question, questionIndex) => (
                        <div key={question.id} className="quiz-question-card">
                          <h3>{`${questionIndex + 1}. ${question.question}`}</h3>
                          <div className="quiz-options">
                            {question.options.map((option, optionIndex) => {
                              const answerKey = `${selectedVideo.id}:${question.id}`;
                              const isSelected = quizAnswers[answerKey] === optionIndex;

                              return (
                                <button
                                  key={`${question.id}-option-${optionIndex}`}
                                  className={`quiz-option ${isSelected ? 'selected' : ''}`}
                                  onClick={() => handleQuizAnswerSelect(question.id, optionIndex)}
                                >
                                  {option}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      <div className="quiz-actions">
                        <button className="control-btn-quiz" onClick={handleQuizSubmit}>
                          <span className="btn-text">Submit Quiz</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="quiz-celebration-screen" role="status" aria-live="polite">
                      <img src={getQuizResultImage(selectedVideo)} alt="Quiz result" className="quiz-celebration-image" />
                      <div className="quiz-celebration-marks">
                        Marks: {getQuizScore(selectedVideo).score} out of {getQuizScore(selectedVideo).total}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="video-player-wrapper">
                    <video
                      key={selectedVideo.id}
                      className="video-player"
                      controls
                      autoPlay
                      controlsList="nodownload"
                      onEnded={handleVideoEnded}
                    >
                      <source
                        src={selectedVideo.videoUrl}
                        type="video/mp4"
                      />
                      Your browser does not support the video tag.
                    </video>
                  </div>
                </>
              )}
              {/* Visual indicator when content protection is active on sensitive pages */}
              {/* {isSensitivePage && <CaptureAlert />} */}
              {/* Navigation Controls — hide on quiz pages */}
              {selectedVideo.contentType !== 'quiz' && (
                <div className="video-controls">
                  {selectedVideo.contentType !== 'activity' && (
                    <button
                      className="control-btn"
                      onClick={handleRepeat}
                      title="Repeat Video"
                    >
                      <span className="btn-icon">🔁</span>
                      <span className="btn-text">Repeat</span>
                    </button>
                  )}
                  <button
                    className="control-btn"
                    onClick={handlePrevious}
                    disabled={getCurrentVideoIndex() === 0}
                    title="Previous"
                  >
                    <span className="btn-icon">⏮️</span>
                    <span className="btn-text">Previous</span>
                  </button>
                  <button
                    className="control-btn"
                    onClick={handleNext}
                    disabled={
                      getCurrentVideoIndex() === getAllVideos().length - 1 ||
                      (selectedVideo.contentType !== 'activity' && !completedVideos.includes(selectedVideo.id))
                    }
                    title="Next"
                  >
                    <span className="btn-icon">⏭️</span>
                    <span className="btn-text">Next</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="placeholder-content">
              <div className="placeholder-icon">🎬</div>
              <h3>No Video Selected</h3>
              <p>Choose a video from the sidebar to start learning</p>
            </div>
          )}
        </div>
        {selectedVideo && selectedVideo.contentType === 'quiz' && submittedQuizzes[selectedVideo.id] && getCurrentVideoIndex() < getAllVideos().length - 1 && (
          <div className="quiz-next-actions global-bottom-right">
            <button className="control-btn" onClick={handleNext}>
              <span className="btn-icon">⏭️</span>
              <span className="btn-text">Next Content</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
} export default CoursesPage;
