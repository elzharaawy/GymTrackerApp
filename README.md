# 🏋️ GymTracker

A modern React Native fitness application that helps users track workouts, monitor progress, and stay consistent with their fitness journey. GymTracker provides an intuitive interface for managing workout routines, exercise history, and personal fitness goals.

---

## 📱 Features

### 🔐 Authentication

* Secure user registration
* User login and logout
* Firebase Authentication integration
* Password recovery

### 👤 User Profile

* Edit profile information
* Upload profile picture
* Personal fitness details
* Body measurements

### 💪 Workout Management

* Create custom workout plans
* Track completed workouts
* View workout history
* Organize exercises by muscle group
* Workout progress tracking

### 📊 Progress Tracking

* Body weight tracking
* Progress statistics
* Workout completion history
* Fitness achievements

### 🖼️ Image Upload

* Upload profile photos
* Workout images
* Cloudinary image storage
* Fast and secure image delivery

### ☁️ Cloud Database

* Firebase Firestore integration
* Real-time data synchronization
* Secure user data storage

---

# 🚀 Tech Stack

## Frontend

* React Native
* Expo
* React Navigation
* React Native Paper
* React Native Vector Icons

## Backend & Cloud

* Firebase Authentication
* Firebase Firestore
* Cloudinary (Image Storage)

## State Management

* React Context API
* React Hooks

---

# 📂 Project Structure

```
GymTracker/
│
├── assets/
├── components/
├── screens/
├── navigation/
├── services/
├── firebase/
├── utils/
├── hooks/
├── context/
├── constants/
├── App.js
├── package.json
└── README.md
```

---

# 📦 Installation

Clone the repository:

```bash
git clone https://github.com/yourusername/GymTracker.git
```

Navigate into the project:

```bash
cd GymTracker
```

Install dependencies:

```bash
npm install
```

or

```bash
yarn install
```

Start the development server:

```bash
npx expo start
```

---

# 🔥 Firebase Configuration

Create a Firebase project and enable:

* Authentication
* Firestore Database

Add your Firebase configuration inside:

```
firebase/config.js
```

Example:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

---

# ☁️ Cloudinary Configuration

Create a free Cloudinary account.

Configure:

```
Cloud Name
API Key
Upload Preset
```

Store these values inside your environment variables or configuration file.

---

# 📸 Screens

* Splash Screen
* Login
* Register
* Home Dashboard
* Workout Details
* Progress
* Profile
* Settings

---

# 🎯 Future Improvements

* Nutrition Tracker
* Water Intake Tracker
* BMI Calculator
* Workout Timer
* Rest Timer
* Dark Mode
* Push Notifications
* Apple Health Integration
* Google Fit Integration
* AI Workout Recommendations
* Offline Mode

---

# 🔒 Security

* Firebase Authentication
* Firestore Security Rules
* Secure Image Uploads
* Input Validation
* Protected Routes

---

# 🤝 Contributing

Contributions are welcome.

1. Fork the repository.
2. Create a new feature branch.
3. Commit your changes.
4. Push to your branch.
5. Open a Pull Request.

---

# 📄 License

This project is licensed under the MIT License.

---

# 👨‍💻 Developer

**Abadir**

Computer Science Student | React Native Developer | Firebase Developer

---

## ⭐ Support

If you found this project helpful, consider giving it a ⭐ on GitHub. Your support helps the project grow and motivates future development.
