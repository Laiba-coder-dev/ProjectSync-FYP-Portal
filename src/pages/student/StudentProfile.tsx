import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatsCard } from '@/components/shared/StatsCard';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  User,
  Mail,
  Hash,
  GraduationCap,
  Building2,
  Calendar,
  Save,
  Camera,
  Phone,
  Award,
  FolderKanban,
  Users,
  UserCheck,
  Loader2,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useStudentData } from '@/hooks/useStudentData';
import { uploadProfilePicture } from '@/lib/services';
import { Student } from '@/types';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phoneNumber: z.string().optional(),
  dateOfBirth: z.string().optional(),
  semester: z.number().min(1).max(12).optional(),
  cgpa: z.number().min(0).max(4).optional(),
  batchYear: z.string().optional(),
  program: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function StudentProfile() {
  const { user, updateUserProfile } = useAuth();
  const { group, project, supervisor, loading: dataLoading } = useStudentData();
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const studentUser = user as Student;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: studentUser?.name || '',
      phoneNumber: studentUser?.phoneNumber || '',
      dateOfBirth: studentUser?.dateOfBirth
        ? format(studentUser.dateOfBirth, 'yyyy-MM-dd')
        : '',
      semester: studentUser?.semester || 8,
      cgpa: studentUser?.cgpa || 0,
      batchYear: studentUser?.batchYear || '',
      program: studentUser?.program || '',
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    try {
      const updateData: Partial<Student> = {
        name: data.name,
        phoneNumber: data.phoneNumber,
        semester: data.semester,
        cgpa: data.cgpa,
        batchYear: data.batchYear,
        program: data.program,
      };

      if (data.dateOfBirth) {
        updateData.dateOfBirth = new Date(data.dateOfBirth);
      }

      await updateUserProfile(updateData);
      setIsEditing(false);
      setAvatarPreview(null);
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  const handleCancel = () => {
    reset();
    setIsEditing(false);
    setAvatarPreview(null);
  };

  const handleAvatarClick = () => {
    if (isEditing && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !studentUser) return;

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload immediately
    setUploading(true);
    try {
      await uploadProfilePicture(studentUser.id, file);
      toast.success('Profile picture updated successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload profile picture');
      setAvatarPreview(null);
    } finally {
      setUploading(false);
    }
  };

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 lg:pb-0">
      <PageHeader
        title="My Profile"
        description="Manage your account settings and view your dashboard"
      >
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
              <Save className="mr-2 h-4 w-4" />
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        )}
      </PageHeader>

      {/* Dashboard Overview Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Project Status"
          value={project?.status ? project.status.charAt(0).toUpperCase() + project.status.slice(1) : 'Not Started'}
          icon={FolderKanban}
          description={project?.title?.substring(0, 30) + '...' || 'Submit your project idea'}
        />
        <StatsCard
          title="Group"
          value={group?.name || 'No Group'}
          icon={Users}
          description={group ? `${group.members.length}/${group.maxMembers} members` : 'Create or join a group'}
        />
        <StatsCard
          title="Supervisor"
          value={supervisor ? 'Assigned' : 'Pending'}
          icon={UserCheck}
          description={supervisor?.name || 'Request a supervisor'}
        />
        <StatsCard
          title="CGPA"
          value={studentUser?.cgpa?.toFixed(2) || 'N/A'}
          icon={Award}
          description={`Semester ${studentUser?.semester || 'N/A'}`}
        />
      </div>

      <Separator />

      {/* Profile Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            {/* Avatar */}
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={avatarPreview || studentUser?.avatar} />
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                  {studentUser?.name?.split(' ').map(n => n[0]).join('') || 'U'}
                </AvatarFallback>
              </Avatar>
              {isEditing && (
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full"
                  onClick={handleAvatarClick}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-2xl font-bold">{studentUser?.name}</h2>
              <p className="text-muted-foreground">{studentUser?.email}</p>
              <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
                <Badge variant="secondary" className="capitalize">
                  {studentUser?.role?.replace('_', ' ') || 'Student'}
                </Badge>
                <Badge variant="outline">{studentUser?.department}</Badge>
                {studentUser?.enrollmentNumber && (
                  <Badge variant="outline">{studentUser.enrollmentNumber}</Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details Form */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Personal Information</CardTitle>
              <CardDescription>Your basic account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Full Name
                </Label>
                {isEditing ? (
                  <>
                    <Input
                      id="name"
                      {...register('name')}
                      placeholder="Enter your full name"
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive">{errors.name.message}</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm font-medium">{studentUser?.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email Address
                </Label>
                <p className="text-sm font-medium text-muted-foreground">{studentUser?.email}</p>
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNumber" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Phone Number
                </Label>
                {isEditing ? (
                  <Input
                    id="phoneNumber"
                    {...register('phoneNumber')}
                    placeholder="+92 300 1234567"
                  />
                ) : (
                  <p className="text-sm font-medium">{studentUser?.phoneNumber || 'Not provided'}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateOfBirth" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Date of Birth
                </Label>
                {isEditing ? (
                  <Input
                    id="dateOfBirth"
                    type="date"
                    {...register('dateOfBirth')}
                  />
                ) : (
                  <p className="text-sm font-medium">
                    {studentUser?.dateOfBirth && studentUser.dateOfBirth instanceof Date && !isNaN(studentUser.dateOfBirth.getTime())
                      ? format(studentUser.dateOfBirth, 'MMMM d, yyyy')
                      : 'Not provided'}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Academic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Academic Information</CardTitle>
              <CardDescription>Your academic details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Enrollment Number
                </Label>
                <p className="text-sm font-medium text-muted-foreground">
                  {studentUser?.enrollmentNumber || 'Not assigned'}
                </p>
                <p className="text-xs text-muted-foreground">Enrollment number cannot be changed</p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Department
                </Label>
                <p className="text-sm font-medium">{studentUser?.department}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="program" className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  Program
                </Label>
                {isEditing ? (
                  <Input
                    id="program"
                    {...register('program')}
                    placeholder="e.g., BS Computer Science"
                  />
                ) : (
                  <p className="text-sm font-medium">{studentUser?.program || 'Not provided'}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="semester" className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  Current Semester
                </Label>
                {isEditing ? (
                  <>
                    <Input
                      id="semester"
                      type="number"
                      min="1"
                      max="12"
                      {...register('semester', { valueAsNumber: true })}
                    />
                    {errors.semester && (
                      <p className="text-sm text-destructive">{errors.semester.message}</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm font-medium">{studentUser?.semester || 'Not provided'}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="cgpa" className="flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  CGPA
                </Label>
                {isEditing ? (
                  <>
                    <Input
                      id="cgpa"
                      type="number"
                      step="0.01"
                      min="0"
                      max="4"
                      {...register('cgpa', { valueAsNumber: true })}
                      placeholder="0.00"
                    />
                    {errors.cgpa && (
                      <p className="text-sm text-destructive">{errors.cgpa.message}</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm font-medium">{studentUser?.cgpa?.toFixed(2) || 'Not provided'}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="batchYear" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Batch Year
                </Label>
                {isEditing ? (
                  <Input
                    id="batchYear"
                    {...register('batchYear')}
                    placeholder="e.g., 2021-2025"
                  />
                ) : (
                  <p className="text-sm font-medium">{studentUser?.batchYear || 'Not provided'}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </form>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account Information</CardTitle>
          <CardDescription>Your account activity details</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Account Created
            </Label>
            <p className="text-sm font-medium">
              {studentUser?.createdAt && studentUser.createdAt instanceof Date && !isNaN(studentUser.createdAt.getTime())
                ? format(studentUser.createdAt, 'MMMM d, yyyy')
                : 'Not available'}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Last Login
            </Label>
            <p className="text-sm font-medium">
              {studentUser?.lastLogin && studentUser.lastLogin instanceof Date && !isNaN(studentUser.lastLogin.getTime())
                ? format(studentUser.lastLogin, 'MMMM d, yyyy h:mm a')
                : 'Not available'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
