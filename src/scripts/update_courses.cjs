const fs = require('fs');
const path = 'src/data/courses.json';
const current = JSON.parse(fs.readFileSync(path, 'utf8'));

const commonVideo = './assets/videos/common/Business_operations_future_platform_9791fe581b.mp4';

const createTopics = (moduleId, day, count, customTitles = {}) => {
  return Array.from({ length: count }, (_, i) => {
    const topicNum = i + 1;
    let title = customTitles[topicNum] || (day === 1 ? `${day}.${topicNum} Context` : `${day}.${topicNum} Content`);
    return {
      id: `${moduleId}-day-${day}-topic-${topicNum}`,
      title: title,
      context1: commonVideo,
      description: `Day ${day} topic`
    };
  });
};

// Robotics Day 1 Titles
const roboticsDay1Titles = {
  1: '1.1 Context', 2: '1.2 What is a Robot', 3: '1.3 Robots are inspired by Humans', 4: '1.4 Robots do human like work and examples',
  5: '1.5 Robots are Everywhere', 6: '1.6 Main parts of Robot', 7: '1.7 Main parts of Robot - Sensors', 8: '1.8 Main parts of Robot - Controller',
  9: '1.9 Main parts of Robot - Actuators', 10: '1.10 Robot Working Principle', 11: '1.11 Real Life Applications of Robot', 
  12: '1.12 Dangerous Work - Real Life Applications of Robot', 13: '1.13 Heavy Work - Real Life Applications of Robot',
  14: '1.14 Repetative Work - Real Life Applications of Robot', 15: '1.15 Accuracy and Precision - Real Life Applications of Robot',
  16: '1.16 Speed - Real Life Applications of Robot', 17: '1.17 Robots help elderly - Real Life Applications of Robot',
  18: '1.18 Robots in Farming - Real Life Applications of Robot', 19: '1.19 Robots at home - Real Life Applications of Robot',
  20: '1.20 Robots protect the enviroment - Real Life Applications of Robot', 21: '1.21 Robots in Space - Real Life Applications of Robot',
  22: '1.22 How robots improve Human Life', 23: '1.23 Future is Robotics', 24: '1.24 Types of Robots', 25: '1.25 Mobile Robots',
  26: '1.26 Humanoid Robots', 27: '1.27 Robotics Arms', 28: '1.28 Industrial Robots', 29: '1.29 Agriculture Robots',
  30: '1.30 Autonomous Robots', 31: '1.31 Entertainment Robots', 32: '1.32 Smart HomeRobots', 33: '1.33 Space Robots',
  34: '1.34 Search and Rescue Robots', 35: '1.35 What we learned', 36: '1.36 Why today was special', 37: '1.37 Final'
};

// IoT Day 2 Titles
const iotDay2Titles = {
  1: '2.1 Context', 2: '2.2 Context', 3: '2.3 Context - What is Arduino', 4: '2.4 Context - What does Arduino do',
  5: '2.5 Context - Pin structure of Arduino', 6: '2.6 Context - Examples', 7: '2.7 Context - Arduino uno summary',
  8: '2.8 Context - Kit components', 9: '2.9 Context 8.1 - LED', 10: '2.10 Context 8.2 - Buzzer', 11: '2.11 Context 8.3 - Push Button',
  12: '2.12 Context 8.4 - Ultrasonic', 13: '2.13 Context 8.5 - DHT11', 14: '2.14 Context 8.6 - LCD Display',
  15: '2.15 Context 8.7 - LDR', 16: '2.16 Context 8.8 - DC Motor', 17: '2.17 Context 8.9 - Bluetooth Module',
  18: '2.18 Context 8.10 - RFID Reader', 19: '2.19 Context 8.11 - Proximity Sensor', 20: '2.20 Context 8.12 - Servo Motor',
  21: '2.21 Context 8.13 - SD Card Module', 22: '2.22 Context 8.14 - RTC Module – Real Time Clock', 23: '2.23 Context 9 - आर्डिनो IDE म्हणजे काय',
  24: '2.24 Context 10 - How to Install Arduino IDE', 25: '2.25 Context 11 - आर्डिनो IDE मध्ये आपण जे program लिहितो', 26: '2.26 Context 12 closing'
};

// Drone Day 1 Titles
const droneDay1Titles = { 2: '1.2 What is Drone', 3: '1.3 History of Drones', 54: '1.54 Final' };

// VR Day 1 Titles
const vrDay1TitlesArr = [
  'Context 1', 'Context 2 - What is VR', 'Context 3 - Normal Video vs VR', 'Context 4 - How does VR give your brain illusions',
  'Context 5 - How does a VR work', 'Context 6 - VR Headset', 'Context 7 - Head Movement Tracking', 'Context 8 - Brain Illusion',
  'Context 9 - How does VR work Summary', 'Context 10 - History of VR', 'Context 11 - VR is everywhere', 'Context 12 - Today\'s VR world',
  'Context 13 - Application of VR', 'Context 13.1 - Education', 'Context 13.2 - Medical', 'Context 13.3 - Military Training',
  'Context 13.4 - Flight Training', 'Context 13.5 - Constrction', 'Context 13.6 - Tourism', 'Context 13.7 - Gaming and Entertainment',
  'Context 13.8 - Space and Science', 'Context 13.9 - Disaster Management', 'Context 13.10 - Treatment and Therapy',
  'Context 13.11 - Applications summary', 'Context 14 - Future of VR', 'Context 14.1 - Future Education',
  'Context 14.2 - Future of Space', 'Context 14.3 - Future of Medical', 'Context 14.4 - Engineering', 'Context 14.5 - VR Office',
  'Context 14.6 - Virtual Shopping', 'Context 14.7 - Farming, Police and Mechanic', 'Context 14.8 - Future of Gaming',
  'Context 14.9 - Virtual Family', 'Context 15 - Careers in VR', 'Context 16 - Safety tips', 'Context 17', 'Context 18', 'Context 19'
];
const vrDay1TitlesObject = {};
vrDay1TitlesArr.forEach((t, i) => { vrDay1TitlesObject[i+1] = `1.${i+1} ${t}`; });

// MR Day 1 Titles
const mrDay1TitlesArr = [
  'Context 1', 'Context 2', 'Context 3', 'Context 4 - What is mixed reality', 'Content -6 Mixed Reality Intro',
  'Content - 7 Mixed Reality Components', 'Content - 8 Real Object', 'Content - 9 Camera and Sensors',
  'Content - 10 Digital Simulation', 'Content - 11 Mixed Interaction', 'Content - 12 Mixed Reality',
  'Content - 13 Mixed Reality', 'Content - 14 Mixed Reality', 'Content - 15', 'Content - 16 Mixed Reality',
  'Content - 17', 'Content - 18', 'Content - 19', 'Content - 20', 'Content - 21', 'Content - 22', 'Content - 23',
  'Content - 24', 'Content - 25', 'Content - 26', 'Content - 27', 'Content - 28', 'Content - 29', 'Content - 30',
  'Content - 31', 'Content - 32', 'Content - 33', 'Content - 34', 'Content - 35', 'Content - 36', 'Content - 37',
  'Content - 38', 'Content - 40'
];
const mrDay1TitlesObject = {};
mrDay1TitlesArr.forEach((t, i) => { mrDay1TitlesObject[i+1] = `1.${i+1} ${t}`; });

current.courses.robotics = { Day1: createTopics('robotics', 1, 37, roboticsDay1Titles), Day2: createTopics('robotics', 2, 56) };
current.courses.iot = { Day1: createTopics('iot', 1, 48), Day2: createTopics('iot', 2, 26, iotDay2Titles) };
current.courses.drone = { Day1: createTopics('drone', 1, 54, droneDay1Titles), Day2: createTopics('drone', 2, 29) };
current.courses['ar-vr'] = { Day1: createTopics('ar-vr', 1, 30) };
current.courses.vr = { Day1: createTopics('vr', 1, 40, vrDay1TitlesObject) };
current.courses.mr = { Day1: createTopics('mr', 1, 38, mrDay1TitlesObject) };
current.courses.ai = { Day1: createTopics('ai', 1, 11), Day2: createTopics('ai', 2, 35) };
current.courses['3d-printing'] = { Day1: createTopics('3d-printing', 1, 40), Day2: createTopics('3d-printing', 2, 11) };

fs.writeFileSync(path, JSON.stringify(current, null, 2));
console.log('Successfully updated src/data/courses.json');
