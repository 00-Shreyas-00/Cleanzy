import { Prisma } from '@prisma/client';

type NotificationClient = {
  notification: {
    create: (args: Prisma.NotificationCreateArgs) => Promise<unknown>;
  };
};

export const logNotification = async (
  client: NotificationClient,
  params: {
    userId: string;
    type: string;
    message: string;
  }
) => {
  await client.notification.create({
    data: {
      user_id: params.userId,
      type: params.type,
      message: params.message,
    },
  });
};

