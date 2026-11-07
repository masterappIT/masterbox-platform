// LINE official accounts. Not connected yet: its conversations can be read but not answered.
import { unsupportedConnector } from './shared/base.js';
import { uncheckedConnection } from './shared/connection.js';

export default { ...unsupportedConnector({ source: 'line', platform: 'line', name: 'line' }), connection: uncheckedConnection };
