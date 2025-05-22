export class User {
  firstName: string;
  lastName: string;
  email: string;
  userId: string;
  avatar: string;

  constructor(obj?: any) {
    this.firstName = obj ? obj.firstName : '';
    this.lastName = obj ? obj.lastName : '';
    this.email = obj ? obj.email : '';
    this.userId = obj ? obj.userId : '';
    this.avatar = obj ? obj.avatar : '';
  }

  public toJson() {
    return {
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      avatar: this.avatar,
    };
  }
}
