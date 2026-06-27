// services/cloudinary.ts

const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME!;
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;

export interface CloudinaryResponse {
  asset_id: string;
  public_id: string;
  version: number;
  version_id: string;
  signature: string;
  width: number;
  height: number;
  format: string;
  resource_type: string;
  created_at: string;
  tags: string[];
  bytes: number;
  type: string;
  etag: string;
  placeholder: boolean;
  url: string;
  secure_url: string;
  folder?: string;
  original_filename: string;
}

export const uploadImage = async (
  imageUri: string,
  folder = "gymtracker/profile"
): Promise<string> => {
  try {
    const formData = new FormData();

    formData.append("file", {
      uri: imageUri,
      type: "image/jpeg",
      name: `profile_${Date.now()}.jpg`,
    } as any);

    formData.append("upload_preset", UPLOAD_PRESET);
    formData.append("folder", folder);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    const data: CloudinaryResponse = await response.json();

    if (!response.ok) {
      throw new Error(
        (data as any)?.error?.message || "Cloudinary upload failed"
      );
    }

    return data.secure_url;
  } catch (error: any) {
    console.error("Cloudinary Error:", error);
    throw new Error(error.message);
  }
};