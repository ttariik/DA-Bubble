import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
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
    ReactiveFormsModule,
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
        this.user = new User({ ...user, userId: this.data.userId });
      });
  }

  close() {
    this.dialogRef.close();
  }

  nameFormControl = new FormControl('', [
    Validators.required,
    Validators.pattern(
      "^[A-ZÄÖÜ][a-zäöüß]+(?:[-'][A-ZÄÖÜ][a-zäöüß]+)?\\s[A-ZÄÖÜ][a-zäöüß]+(?:[-'][A-ZÄÖÜ][a-zäöüß]+)?$"
    ),
  ]);

  userForm = new FormGroup({
    name: this.nameFormControl,
  });

  get name() {
    return this.nameFormControl;
  }

  async onSubmit() {
    if (this.userForm.valid) {
      const { name } = this.userForm.value;
      if (name != null) {
        const newName = name.split(' ');
        try {
          await this.firestoreService.updateUser(this.user.userId, {
            firstName: newName[0],
            lastName: newName[1],
          });
          this.openEditModal();
        } catch (error) {
          console.warn(error);
        }
      }
    }
  }

  openEditModal() {
    this.showEditModal = !this.showEditModal;
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }
}
