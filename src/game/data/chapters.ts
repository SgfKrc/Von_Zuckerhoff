import type { ChapterId } from '../types'

export interface ChapterDef {
  no: ChapterId
  num: string
  name: string
  quote: string
  implemented: boolean
}

/** 垂直切片：序章 + 第一章 */
export const CHAPTERS: ChapterDef[] = [
  {
    no: 0,
    num: '序章',
    name: '糖堡站',
    quote: '「它不是人类建造的——不，它是人类建造的，但建造它的人，一定已经不把自己当人了。」',
    implemented: true,
  },
  {
    no: 1,
    num: '第一章',
    name: '糖庄',
    quote: '「甜是生命，亦是死亡。」',
    implemented: true,
  },
]

export function chapter(no: ChapterId): ChapterDef {
  return CHAPTERS.find(c => c.no === no) ?? CHAPTERS[0]
}
