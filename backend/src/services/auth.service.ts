import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';
import { User } from '../models/User';
import { UnauthorizedError } from '../utils/errors';

const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export const verifyGoogleTokenAndGetUser = async (token: string) => {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new UnauthorizedError('Invalid Google token payload');
    }

    const { sub: googleId, email, name, picture: avatarUrl } = payload;

    let user = await User.findOne({ googleId });
    if (!user) {
      // Check if user exists with the same email but different provider
      user = await User.findOne({ email });
      if (user) {
        user.googleId = googleId;
        user.avatarUrl = avatarUrl || user.avatarUrl;
        await user.save();
      } else {
        user = await User.create({
          googleId,
          email,
          name: name || 'User',
          avatarUrl,
        });
      }
    }

    return user;
  } catch (error) {
    throw new UnauthorizedError('Google authentication failed');
  }
};
