import Utils from './Utils';

const static_variable = {
  server_url: Utils.getServerUrl(),
  login_url:  Utils.getLoginUrl(),
  app_name:   Utils.getAppName(),
} as const;

export default static_variable;
