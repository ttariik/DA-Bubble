export class User {
  firstName: string;
  lastName: string;
  email: string;
  userId: string;
  avatar: string;

  constructor(obj?: any) {
    this.firstName = obj.firstName ? obj.firstName : '';
    this.lastName = obj.lastName ? obj.lastName : '';
    this.email = obj.email ? obj.email : '';
    this.userId = obj.userId ? obj.userId : '';
    this.avatar = obj.avatar ? obj.avatar : 'noProfile.svg';
  }

  public toJson() {
    return {
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      avatar: this.avatar,
    };
  }

  public getUserId() {
    return this.userId;
  }
}
