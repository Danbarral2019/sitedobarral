import { describe, expect, it } from 'vitest';
import { isAllowedPushEndpoint } from '../push-endpoint';

describe('isAllowedPushEndpoint', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc:123',
    'https://updates.push.services.mozilla.com/wpush/v2/gAAAA',
    'https://wns2-bl2p.notify.windows.com/w/?token=abc',
    'https://web.push.apple.com/QGx1',
    'https://api.push.apple.com/3/device/abc',
  ])('aceita %s', (url) => {
    expect(isAllowedPushEndpoint(url)).toBe(true);
  });

  it.each([
    'http://fcm.googleapis.com/fcm/send/abc',
    'https://evil.com/fcm.googleapis.com',
    'https://fcm.googleapis.com.evil.com/x',
    'https://notify.windows.com.evil.com/x',
    'https://evilpush.apple.com/x',
    'https://.push.apple.com/x',
    'https://user:pw@fcm.googleapis.com/x',
    'https://fcm.googleapis.com:8443/x',
    'https://169.254.169.254/latest/meta-data',
    'http://localhost:3000/api/admin',
    'não é url',
    '',
    42,
    null,
  ])('recusa %s', (url) => {
    expect(isAllowedPushEndpoint(url)).toBe(false);
  });
});
