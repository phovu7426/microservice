export enum StatsSortBy {
  views = 'views',
  follows = 'follows',
  rating = 'rating',
}

export const StatsSortByOptions = [
  { value: StatsSortBy.views, label: 'Lượt xem' },
  { value: StatsSortBy.follows, label: 'Lượt theo dõi' },
  { value: StatsSortBy.rating, label: 'Đánh giá' },
];
