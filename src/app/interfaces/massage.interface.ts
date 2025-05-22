import { MassageThead } from './massageThead.interface';

export interface Massage {
  text: string;
  sender: string; //UserId vom Absender
  timeStamp: string;
  reactions: string[];
  thread: MassageThead[];
  markings: string[];
}
