import { describe, it, expect } from 'vitest';
import { extractImageUrls } from '../../src/pipeline/email';
import { MAX_ARTICLE_IMAGES } from '../../src/pipeline/constants';

const chart = (n: number) =>
  `https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto:good/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fchart${n}.png`;
const img = (src: string, attrs = '') => `<img ${attrs} src="${src}">`;

describe('extractImageUrls', () => {
  it('keeps content charts (substackcdn /image/ with large w_, c_limit)', () => {
    expect(extractImageUrls(img(chart(1)))).toEqual([chart(1)]);
  });
  it('drops avatars/logos (c_fill, g_face, or small w_)', () => {
    const avatar = 'https://substackcdn.com/image/fetch/w_64,h_64,c_fill,g_face,f_auto/https%3A%2F%2Favatar.jpg';
    const smallLogo = 'https://substackcdn.com/image/fetch/w_120,c_limit,f_auto/https%3A%2F%2Flogo.png';
    expect(extractImageUrls(img(avatar) + img(smallLogo))).toEqual([]);
  });
  it('drops tracking pixels (open.substack.com / 1x1)', () => {
    const pixel = 'https://open.substack.com/pub/fomosoc/p/x.gif?width=1&height=1';
    expect(extractImageUrls(img(pixel, 'width="1" height="1"'))).toEqual([]);
  });
  it('drops non-substack images', () => {
    expect(extractImageUrls(img('https://example.com/x.png'))).toEqual([]);
  });
  it('dedups identical URLs', () => {
    expect(extractImageUrls(img(chart(1)) + img(chart(1)))).toEqual([chart(1)]);
  });
  it('caps at MAX_ARTICLE_IMAGES', () => {
    const many = Array.from({ length: MAX_ARTICLE_IMAGES + 3 }, (_, i) => img(chart(i))).join('');
    expect(extractImageUrls(many)).toHaveLength(MAX_ARTICLE_IMAGES);
  });
  it('drops a content-host image whose w_ is under 400 (isolates the size branch)', () => {
    const small = 'https://substackcdn.com/image/fetch/w_120,c_limit,f_auto/https%3A%2F%2Fexample.com%2Fpic.png';
    expect(extractImageUrls(`<img src="${small}">`)).toEqual([]);
  });
  it('drops a 1x1 pixel served from the content host (isolates the attribute branch)', () => {
    const px = 'https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto/https%3A%2F%2Fexample.com%2Fp.png';
    expect(extractImageUrls(`<img width="1" height="1" src="${px}">`)).toEqual([]);
  });

  it('keeps only the content chart when chart + logo + avatar + button + pixel coexist', () => {
    const chartUrl = 'https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fchart.png';
    const avatar = 'https://substackcdn.com/image/fetch/w_64,h_64,c_fill,g_face,f_auto/https%3A%2F%2Favatar.jpg';
    const cover = 'https://substackcdn.com/image/fetch/w_1300,h_650,c_fill,g_auto,f_auto/https%3A%2F%2Fcover.jpg';
    const button = 'https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto/https%3A%2F%2Fexample.com%2Fsubscribe-button.png';
    const pixel = 'https://open.substack.com/pub/fomosoc/p/x.gif';
    const html = [chartUrl, avatar, cover, button, pixel]
      .map((u, i) => (i === 4 ? `<img width="1" height="1" src="${u}">` : `<img src="${u}">`))
      .join('\n');
    expect(extractImageUrls(html)).toEqual([chartUrl]);
  });

  it('drops g_auto cover crops and /pub/ or button/logo path markers', () => {
    const gauto = 'https://substackcdn.com/image/fetch/w_1300,c_limit,g_auto,f_auto/https%3A%2F%2Fx.jpg';
    const pubPath = 'https://substackcdn.com/image/fetch/w_800,c_limit,f_auto/https%3A%2F%2Fsub.example.com%2Fpub%2Fbanner.png';
    const logo = 'https://substackcdn.com/image/fetch/w_800,c_limit,f_auto/https%3A%2F%2Fexample.com%2Flogo.png';
    expect(extractImageUrls(`<img src="${gauto}">`)).toEqual([]);
    expect(extractImageUrls(`<img src="${pubPath}">`)).toEqual([]);
    expect(extractImageUrls(`<img src="${logo}">`)).toEqual([]);
  });
});
