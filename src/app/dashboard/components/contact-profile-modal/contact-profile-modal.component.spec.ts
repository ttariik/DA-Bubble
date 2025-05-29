import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContactProfileModalComponent } from './contact-profile-modal.component';

describe('ContactProfileModalComponent', () => {
  let component: ContactProfileModalComponent;
  let fixture: ComponentFixture<ContactProfileModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactProfileModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ContactProfileModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
