import immich from './immich'
import { Request, Response } from 'express-serve-static-core'
import { Asset, AssetType, ImageSize, SharedLink } from './types'

class Render {
  async assetBuffer (res: Response, asset: Asset, {size, range}: { size?: ImageSize; range?: string } = {}) {
    let data = await immich.getAssetBuffer(asset, {size: size, range: range})
    if (data) {
      let headers: Record<string, string> = {};
      for (const header of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag']) {
        if (data.headers.get(header))
          res.set(header, data.headers.get(header));
      }
      res.writeHead(data.status, {});

      let close_me = false;
      res.req.on('close', () => { close_me = true; })
      for await (const chunk of data.body) {
        res.write(chunk);
        if (close_me)
          break;
      }

      await res.end();
    } else {
      res.status(404).send()
    }
  }

  /**
   * Render a gallery page for a given SharedLink, using EJS and lightGallery.
   *
   * @param req - ExpressJS Request
   * @param res - ExpressJS Response
   * @param share - Immich `shared-link` containing the assets to show in the gallery
   * @param [openItem] - Immediately open a lightbox to the Nth item when the gallery loads
   */
  async gallery (req: Request, res: Response, share: SharedLink, openItem?: number) {
    const items = []
    const baseurl = 'https://' + req.get('host');
    for (const asset of share.assets) {
      let video, video_src, video_type
      if (asset.type === AssetType.video) {
        video_src = immich.videoUrl(share.key, asset.id);
        video_type = await immich.getContentType(asset);
        // Populate the data-video property
        video = JSON.stringify({
          source: [
            {
              src: video_src,
              type: video_type
            }
          ],
          attributes: {
            preload: false,
            controls: true
          }
        })
      }
      items.push({
        originalUrl: immich.photoUrl(share.key, asset.id),
        thumbnailUrl: immich.photoUrl(share.key, asset.id, ImageSize.thumbnail),
        video_src: video_src,
        video_type: video_type,
        video,
      })
    }
    res.render('gallery', {
      items,
      baseurl,
      openItem
    })
  }
}

const render = new Render()

export default render
