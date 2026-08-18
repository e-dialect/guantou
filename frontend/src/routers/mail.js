import { goMailDetail, goMails, goMailSend } from '@/services/navigation';

export const toMailDetailsPage = (id) => goMailDetail(id);
export const toMailsSendingPage = () => goMailSend();
export const toMailsPage = () => goMails();
