export const getEnvErrors = () => {
    const required = [
        'VITE_FIREBASE_API_KEY',
        'VITE_FIREBASE_AUTH_DOMAIN',
        'VITE_FIREBASE_PROJECT_ID',
        'VITE_FIREBASE_STORAGE_BUCKET',
        'VITE_FIREBASE_MESSAGING_SENDER_ID',
        'VITE_FIREBASE_APP_ID'
    ];
    
    const errors: string[] = [];
    for (const key of required) {
        if (!import.meta.env[key]) {
            errors.push(key);
        }
    }
    
    // Optional, but good to check others if you want
    // if (!import.meta.env.VITE_CLOUDINARY_CLOUD_NAME) errors.push('VITE_CLOUDINARY_CLOUD_NAME');
    
    return errors;
};
