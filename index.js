// Supabase Realtime changes URL.protocol while creating its endpoint. Hermes'
// native URL implementation exposes protocol as read-only, so install the
// React Native URL polyfill before any app modules create the Supabase client.
import 'react-native-url-polyfill/auto';

import { AppRegistry } from 'react-native';
import App from './src/App.tsx';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
