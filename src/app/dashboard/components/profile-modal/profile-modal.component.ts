import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { User } from '../../../models/user.class';
import { FirestoreService } from '../../../services/firestore.service';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { Subscription } from 'rxjs';

export interface DialogData {
  activUserId: string;
  userId: string;
}

@Component({
  selector: 'app-profile-modal',
  templateUrl: './profile-modal.component.html',
  styleUrls: ['./profile-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    MatButtonModule,
  ],
  animations: [],
})
export class ProfileModalComponent {
  readonly dialogRef = inject(MatDialogRef<ProfileModalComponent>);
  readonly data = inject<DialogData>(MAT_DIALOG_DATA);
  user: User = new User({});
  private sub?: Subscription;

  private firestoreService = inject(FirestoreService);

  showEditModal = false;
  tempUserName = '';
  constructor() {}

  ngOnInit() {
    this.sub = this.firestoreService
      .subscribeSingelUser(this.data.userId)
      .subscribe((user) => {
        this.user = new User(user);
      });
  }

  close() {
    this.dialogRef.close();
  }

  openEditModal() {
    // this.tempUserName = this.userName;
    // this.showEditModal = true;
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }
}
