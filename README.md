# 🧭 Project Compass: The Future of FYP Management

Welcome to **Project Compass**, the definitive platform designed to revolutionize how Final Year Projects (FYP) are managed, tracked, and delivered at the University of Sialkot. 

This project is fully portable, reproducible, and ready to be run on any system with minimal setup. It features a complete split of frontend infrastructure (React/Vite) integrated with Backend-as-a-Service (Firebase), along with robust dependency management, validation, and Docker support.

---

## 🚀 Setup Instructions

### 1. Prerequisites
Ensure you have the following installed on your machine:
- **Node.js**: v20.x (As specified in `.nvmrc`)
- **npm**: v10.x+ 
- **Git**

### 2. Clone the Repository
```bash
git clone https://github.com/mrfool05/Project-Compass.git
cd Project-Compass
```

### 3. Install Dependencies
This project uses `npm` for dependency management. A `package-lock.json` lockfile is included to ensure predictable and reproducible builds.
```bash
npm install
```

### 4. Environment Configuration
The project relies on environment variables to connect to Firebase and other services. **No secrets are hardcoded in the codebase.** 

1. Create a copy of the example environment file:
```bash
cp .env.example .env
```
2. Open `.env` and fill in your Firebase project credentials. You can find these in the Firebase Console -> Project Settings -> General.

*Note: The application includes a startup validation layer. If any required environment variables are missing, the app will display a helpful error message detailing exactly which keys are missing instead of crashing silently.*

### 5. Database Setup (Firebase)
Project Compass uses **Firebase Firestore** as its database and **Firebase Auth** for authentication.

1. Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
2. Enable **Firestore Database** (start in Test Mode for local dev).
3. Enable **Authentication** (Email/Password).
4. Enable **Storage** (for document uploads).
5. Ensure your Firebase configuration is added to the `.env` file.

#### Seeding Initial Test Data
To populate the database with dummy data (e.g., an Admin user) so you aren't testing on an empty system:
```bash
npm run seed
```
This script will connect to your Firebase project and insert starting data. No local database installation is necessary!

### 6. Run the Application
Start the development server:
```bash
npm run dev
```
Open `http://localhost:8080/` in your browser.

---

## 🐳 Docker Support (Highly Recommended)

For an isolated and truly reproducible environment, you can run the application using Docker. This ensures the app uses the exact Node version and Nginx configuration across all devices.

### Using Docker Compose
Ensure you have Docker and Docker Compose installed, then run:
```bash
docker-compose up -d --build
```
This will:
1. Copy your local `.env` file.
2. Build the production files.
3. Serve them using Nginx on port `8080`.

Open `http://localhost:8080/` in your browser.

---

## 🛠️ Build & Run Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts the local dev server using Vite. |
| `npm run build` | Compiles the project for production. |
| `npm run preview` | Previews the production build locally. |
| `npm run lint` | Runs ESLint to identify format and syntax issues. |
| `npm run seed` | Seeds the Firebase database with initial test data. |

---

## 🛡️ Error Handling & Fallbacks

- **Environment Validation**: If you launch the app without the proper `.env` file, the UI will safely gracefully degrade to an error screen enumerating the missing variables.
- **Firebase Initialization**: Analytics and non-critical Firebase services fail gracefully in development to prevent UI blocking.
- **Routing**: Safe multi-stage routing ensures users are bounced to the Login or Unauthorized page instead of crashing if they try to access restricted dashboards.

---

## 🏗️ Architecture & Technologies

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui
- **State Management**: TanStack Query
- **Backend / Database**: Firebase (Auth, Firestore, Storage)
- **CI/CD**: GitHub Actions (linting and building on Push/PR)
- **Containerization**: Docker, Nginx

---

## 🤝 Contributing

This is a university project, but we welcome ideas! Make sure to run `npm run lint` and verify your build passes the GitHub Actions CI workflow before submitting a Pull Request.

## 📄 License

Proprietary Software - Developed for the University of Sialkot.
