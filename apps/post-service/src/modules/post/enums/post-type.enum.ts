export enum PostType {
  text = 'text',
  video = 'video',
  image = 'image',
  audio = 'audio',
}

export const PostTypeOptions = [
  { value: PostType.text, label: 'Văn bản' },
  { value: PostType.video, label: 'Video' },
  { value: PostType.image, label: 'Hình ảnh' },
  { value: PostType.audio, label: 'Âm thanh' },
];
