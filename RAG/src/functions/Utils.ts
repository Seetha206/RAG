type Environment = 'development' | 'testlive' | 'production';
const env = import.meta.env.MODE as Environment;

const Utils = {
  getServerUrl: (): string => {
    if (env === 'development') return 'http://localhost:8000';
    if (env === 'testlive')    return 'https://testlive.yourapp.com';
    return                            'https://services.yourapp.com';
  },
  getLoginUrl: (): string => {
    if (env === 'development') return 'http://localhost:3000/#/login';
    if (env === 'testlive')    return 'https://testlive.yourapp.com/#/login';
    return                            'https://yourapp.com/#/login';
  },
  getAppName: (): string => import.meta.env.VITE_APP_NAME ?? 'RAG',
};

export default Utils;
