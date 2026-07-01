import { upload } from '@/utils/httpClient';

/**
 * 上传文件
 * @param file 文件对象（路径）
 * @returns {Promise<unknown>}
 */
export function uploadFile(file) {
  return upload(file);
}

/**
 * 选择并上传图片
 * @param maxNumber 最大数量
 * @return{Promise<string[]>} URL 列表
 */
export async function chooseAndUploadImages(maxNumber = 1) {
  const images = await new Promise((resolve) => {
    uni.chooseImage({
      count: maxNumber,
      success: async (res) => {
        try {
          const uploaded = await Promise.all(
            res.tempFilePaths.map((path) => uploadFile(path)),
          );
          resolve(uploaded);
        } catch (error) {
          uni.showToast({
            title: error.message || '上传失败',
            icon: 'none',
          });
          resolve([]);
        }
      },
      fail: (err) => {
        uni.showToast({
          title: err.errMsg || '选择图片失败',
          icon: 'none',
        });
        resolve([]);
      },
    });
  });
  return images.map((item) => item.url);
}

/**
 * 选择并上传一张图片
 * @returns {Promise<string>} 图片的 url
 */
export async function chooseAndUploadAnImage() {
  const images = await chooseAndUploadImages(1);
  return images[0];
}
