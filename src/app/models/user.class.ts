export class User {
  firstName: string;
  lastName: string;
  email: string;
  userId: string;
  avatar: string;
  isActive: boolean;

  constructor(obj?: any) {
    this.firstName = obj.firstName ? obj.firstName : '';
    this.lastName = obj.lastName ? obj.lastName : '';
    this.email = obj.email ? obj.email : '';
    this.userId = obj.userId ? obj.userId : '';
    this.avatar = obj.avatar ? obj.avatar : 'noProfile.svg';
    this.isActive = obj.isActive ? obj.isActive : false;
  }

  public toJson() {
    return {
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      avatar: this.avatar,
      isActive: this.isActive,
    };
  }

  public getUserId() {
    return this.userId;
  }
}
