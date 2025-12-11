import avatarPlaceholder from "@/assets/avatar-placeholder.png";
import CropImageDialog from "@/components/CropImageDialog";
import LoadingButton from "@/components/LoadingButton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import LocationSelector from "@/components/LocationSelector";
import { UserData } from "@/lib/types";
import {
  updateUserProfileSchema,
  UpdateUserProfileValues,
} from "@/lib/validation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera } from "lucide-react";
import Image, { StaticImageData } from "next/image";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import Resizer from "react-image-file-resizer";
import { useUpdateProfileMutation } from "./mutations";

const INTEREST_TAGS = [
  "Technology",
  "Sports",
  "Music",
  "Art",
  "Travel",
  "Food",
  "Fashion",
  "Photography",
  "Gaming",
  "Fitness",
  "Books",
  "Movies",
  "Science",
  "Business",
  "Education",
  "Health",
  "Nature",
  "Pets",
];

interface EditProfileDialogProps {
  user: UserData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
function getInitialLocationIds(user: UserData) {
  // Now database stores IDs directly, so just return them
  return {
    countryCode: user.countryCode || null,
    provinceCode: user.provinceCode || null,
    districtCode: user.districtCode || null,
  };
}

export default function EditProfileDialog({
  user,
  open,
  onOpenChange,
}: EditProfileDialogProps) {
  const initialLocation = getInitialLocationIds(user);
  const form = useForm<UpdateUserProfileValues>({
    resolver: zodResolver(updateUserProfileSchema),
    defaultValues: {
      displayName: user.displayName,
      bio: user.bio || "",
      interests: user.interests || [],
      countryCode: initialLocation.countryCode,
      provinceCode: initialLocation.provinceCode,
      districtCode: initialLocation.districtCode,
    },
  });

  // Reset form when dialog opens or user data changes
  useEffect(() => {
    if (open) {
      const locationToReset = getInitialLocationIds(user);
      form.reset({
        displayName: user.displayName,
        bio: user.bio || "",
        interests: user.interests || [],
        countryCode: locationToReset.countryCode,
        provinceCode: locationToReset.provinceCode,
        districtCode: locationToReset.districtCode,
      });
    }
  }, [open, user, form]);

  const mutation = useUpdateProfileMutation();

  const [croppedAvatar, setCroppedAvatar] = useState<Blob | null>(null);

  // Watch location fields - must be called at top level, not inside render callback
  const countryCode = useWatch({
    control: form.control,
    name: "countryCode",
  });
  const provinceCode = useWatch({
    control: form.control,
    name: "provinceCode",
  });
  const districtCode = useWatch({
    control: form.control,
    name: "districtCode",
  });

  async function onSubmit(values: UpdateUserProfileValues) {
    const newAvatarFile = croppedAvatar
      ? new File([croppedAvatar], `avatar_${user.id}.webp`, {
          type: "image/webp",
        }) // <--- FIX HERE
      : undefined;

    mutation.mutate(
      {
        values,
        avatar: newAvatarFile,
      },
      {
        onSuccess: () => {
          setCroppedAvatar(null);
          onOpenChange(false);
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
        </DialogHeader>
        <div className="flex-1 space-y-4 overflow-y-auto pr-2">
          <div className="space-y-1.5">
            <Label>Avatar</Label>
            <AvatarInput
              src={
                croppedAvatar
                  ? URL.createObjectURL(croppedAvatar)
                  : user.avatarUrl || avatarPlaceholder
              }
              onImageCropped={setCroppedAvatar}
            />
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your display name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Tell us a little bit about yourself"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="interests"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Interests</FormLabel>
                    <FormControl>
                      <div className="flex flex-wrap gap-2">
                        {INTEREST_TAGS.map((interest) => {
                          const currentInterests = field.value || [];
                          const isSelected =
                            currentInterests.includes(interest);
                          const isDisabled = false;
                          return (
                            <Badge
                              key={interest}
                              variant={isSelected ? "default" : "outline"}
                              className="cursor-pointer"
                              onClick={() => {
                                if (isSelected) {
                                  field.onChange(
                                    currentInterests.filter(
                                      (i) => i !== interest
                                    )
                                  );
                                } else {
                                  field.onChange([
                                    ...currentInterests,
                                    interest,
                                  ]);
                                }
                              }}
                            >
                              {interest}
                            </Badge>
                          );
                        })}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="countryCode"
                render={() => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <LocationSelector
                        countryCode={countryCode}
                        provinceCode={provinceCode}
                        districtCode={districtCode}
                        onCountryChange={(code) => {
                          form.setValue("countryCode", code);
                          form.setValue("provinceCode", null);
                          form.setValue("districtCode", null);
                        }}
                        onProvinceChange={(code) => {
                          form.setValue("provinceCode", code);
                          form.setValue("districtCode", null);
                        }}
                        onDistrictChange={(code) => {
                          form.setValue("districtCode", code);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="mt-4 border-t pt-4">
                <LoadingButton type="submit" loading={mutation.isPending}>
                  Save
                </LoadingButton>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface AvatarInputProps {
  src: string | StaticImageData;
  onImageCropped: (blob: Blob | null) => void;
}

function AvatarInput({ src, onImageCropped }: AvatarInputProps) {
  const [imageToCrop, setImageToCrop] = useState<File>();

  const fileInputRef = useRef<HTMLInputElement>(null);

  function onImageSelected(image: File | undefined) {
    if (!image) return;

    Resizer.imageFileResizer(
      image,
      1024,
      1024,
      "WEBP",
      100,
      0,
      (uri) => setImageToCrop(uri as File),
      "file"
    );
  }

  return (
    <>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => onImageSelected(e.target.files?.[0])}
        ref={fileInputRef}
        className="sr-only hidden"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="group relative block"
      >
        <Image
          src={src}
          alt="Avatar preview"
          width={150}
          height={150}
          className="size-32 flex-none rounded-full object-cover"
        />
        <span className="absolute inset-0 m-auto flex size-12 items-center justify-center rounded-full bg-black bg-opacity-30 text-white transition-colors duration-200 group-hover:bg-opacity-25">
          <Camera size={24} />
        </span>
      </button>
      {imageToCrop && (
        <CropImageDialog
          src={URL.createObjectURL(imageToCrop)}
          cropAspectRatio={1}
          onCropped={onImageCropped}
          onClose={() => {
            setImageToCrop(undefined);
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
          }}
        />
      )}
    </>
  );
}
